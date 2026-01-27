# Azure Container Apps Deployment Guide

Deploy containerized applications and jobs to Azure Container Apps for serverless container hosting with auto-scaling.

---

## Overview

Azure Container Apps is a fully managed serverless container platform ideal for:
- **Full-stack web applications** with separate frontend (UI) and backend (API) services
- **Microservices architectures** with multiple interconnected services
- **RESTful APIs** with auto-scaling capabilities
- **Event-driven applications** that respond to messages or events
- **Scheduled tasks and cron jobs** using Container Apps Jobs
- **Batch processing** with event-driven or manual triggers

**Key features:**
- Serverless Kubernetes-based platform (no cluster management)
- Auto-scaling based on HTTP traffic, CPU, memory, or custom metrics
- Built-in load balancing and ingress
- HTTPS ingress with automatic certificate management
- Scale-to-zero for cost optimization
- Azure Container Registry (ACR) integration with managed identity

---

## When to Use

### Container Apps (Long-running services)
- Full-stack web applications (e.g., todo apps, blogs, e-commerce)
- Single-page applications (SPA) with backend APIs
- Microservices deployment with inter-service communication
- API hosting with auto-scaling
- Background workers without ingress
- Event-driven applications

### Container Apps Jobs (Finite-duration tasks)
- Scheduled tasks (cron jobs, daily reports, cleanup)
- Batch processing (ETL, data transformation)
- Data pipelines and migrations
- Queue processors (Azure Storage Queues, Service Bus)
- On-demand maintenance tasks
- CI/CD runners (GitHub Actions agents)
- Machine learning training and inference jobs

---

## Prerequisites

**Validate all prerequisites before deployment:**

```bash
# Check Docker is running (CRITICAL)
docker ps

# If Docker isn't running, start Docker Desktop:
# Windows: Search for "Docker Desktop" in Start menu
# macOS: Open Docker Desktop from Applications

# Check Azure CLI authentication
az account show

# If not authenticated
az login

# Check Azure Developer CLI authentication (for azd deployments)
azd auth login --check-status

# If not authenticated
azd auth login
```

**Common failure:** Attempting to build images when Docker daemon isn't started. Always verify `docker ps` succeeds before deployment.

---

## Architecture Patterns

### Pattern 1: Single Container (Simple Apps)

**Best for:** Simple full-stack apps where backend serves both API and static frontend.

```
Frontend files (HTML/CSS/JS) → Backend serves static + API
                              ↓
                    Single Container App
                    - Port 3000 (or 80)
                    - Routes: /api/* → API logic
                    - Routes: /* → Static files
```

**Example Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy backend and frontend
COPY api/ ./api/
COPY web/ ./web/

# Expose port
EXPOSE 3000

# Start server (serves both static and API)
CMD ["node", "api/server.js"]
```

### Pattern 2: Two Containers (Separate Frontend/Backend)

**Best for:** Larger apps with independent scaling needs.

```
Frontend Container          Backend Container
- Nginx/Static Server      - Node.js/Python/Java API
- Port 80                  - Port 3000
- Calls backend via URL    - Handles business logic
- External ingress         - Internal or external ingress
```

### Pattern 3: Microservices (Multiple Services)

**Best for:** Complex applications with multiple backend services.

```
Frontend → API Gateway → [Auth Service, Data Service, Email Service]
                        ↓
                Container Apps Environment
                - Service discovery
                - Internal communication
                - Shared Log Analytics
```

---

## Quick Start: Single Container App

```bash
# Set variables
PROJECT_NAME="myapp"
RESOURCE_GROUP="myapp-rg"
LOCATION="eastus"
CONTAINER_APP_ENV="myapp-env"
ACR_NAME="myappacr$(date +%s)"

# 1. Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Create Container Apps environment
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# 3. Create Azure Container Registry
az acr create \
  --name $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku Basic \
  --admin-enabled true

# 4. Build and push image to ACR
az acr build \
  --registry $ACR_NAME \
  --image $PROJECT_NAME:latest \
  --file Dockerfile \
  .

# 5. Create container app with managed identity for ACR
az containerapp create \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image ${ACR_NAME}.azurecr.io/${PROJECT_NAME}:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-identity system \
  --min-replicas 1 \
  --max-replicas 10 \
  --cpu 0.5 \
  --memory 1Gi

# 6. Assign AcrPull role to managed identity
IDENTITY_ID=$(az containerapp show \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query identity.principalId -o tsv)

ACR_ID=$(az acr show \
  --name $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --query id -o tsv)

az role assignment create \
  --assignee $IDENTITY_ID \
  --role AcrPull \
  --scope $ACR_ID

# 7. Get URL
az containerapp show \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv
```

---

## Multi-Service Deployment (Frontend + Backend)

### Scenario: Todo App with Separate UI and API

**Project structure:**
```
todo-app/
├── web/                 # Frontend (React/Vue/Angular)
│   ├── Dockerfile
│   └── dist/
├── api/                 # Backend (Node.js/Python)
│   ├── Dockerfile
│   └── src/
└── docker-compose.yml   # Optional: local testing
```

**Backend Dockerfile (api/Dockerfile):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**Frontend Dockerfile (web/Dockerfile):**
```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Deployment commands:**
```bash
# Build and push backend
az acr build \
  --registry $ACR_NAME \
  --image todo-api:latest \
  --file api/Dockerfile \
  ./api

# Build and push frontend
az acr build \
  --registry $ACR_NAME \
  --image todo-web:latest \
  --file web/Dockerfile \
  ./web

# Deploy backend (internal ingress)
az containerapp create \
  --name todo-api \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image ${ACR_NAME}.azurecr.io/todo-api:latest \
  --target-port 3000 \
  --ingress internal \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-identity system \
  --env-vars "DATABASE_URL=secretref:db-connection" \
  --secrets "db-connection=$DATABASE_URL" \
  --cpu 0.5 \
  --memory 1Gi

# Deploy frontend (external ingress)
API_URL=$(az containerapp show \
  --name todo-api \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

az containerapp create \
  --name todo-web \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image ${ACR_NAME}.azurecr.io/todo-web:latest \
  --target-port 80 \
  --ingress external \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-identity system \
  --env-vars "API_BASE_URL=https://${API_URL}" \
  --cpu 0.25 \
  --memory 0.5Gi
```

---

## Container Apps Jobs

### Job Types Overview

| Job Type | Trigger | Use Case | Scaling |
|----------|---------|----------|---------|
| **Manual** | On-demand via CLI/API | One-time tasks, maintenance | 1 execution per trigger |
| **Schedule** | Cron expression | Recurring tasks, reports | Runs on schedule |
| **Event** | Queue messages, scalers | Message processing | Scales based on queue depth |

### Scheduled Job (Cron)

**Use case:** Daily report generation, cleanup tasks, data backups

```bash
# Create scheduled job (daily at 2 AM UTC)
az containerapp job create \
  --name daily-report-job \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --trigger-type Schedule \
  --cron-expression "0 2 * * *" \
  --replica-timeout 1800 \
  --replica-retry-limit 3 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image ${ACR_NAME}.azurecr.io/report-generator:latest \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-identity system \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars "REPORT_TYPE=daily"
```

**Common cron expressions:**
| Expression | Description |
|------------|-------------|
| `*/5 * * * *` | Every 5 minutes |
| `0 */2 * * *` | Every 2 hours |
| `0 0 * * *` | Daily at midnight (UTC) |
| `0 0 * * 0` | Every Sunday at midnight |
| `0 0 1 * *` | First day of month |
| `0 8 * * 1-5` | Weekdays at 8 AM |

**⚠️ Important:** All cron times are in UTC. Adjust for your local timezone.

### Manual Job (On-Demand)

**Use case:** Database migrations, one-time data imports

```bash
# Create manual job
az containerapp job create \
  --name migration-job \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --trigger-type Manual \
  --replica-timeout 3600 \
  --replica-retry-limit 1 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image ${ACR_NAME}.azurecr.io/db-migrator:latest \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-identity system \
  --cpu 0.5 \
  --memory 1Gi

# Execute job
az containerapp job start \
  --name migration-job \
  --resource-group $RESOURCE_GROUP

# Check execution status
az containerapp job execution list \
  --name migration-job \
  --resource-group $RESOURCE_GROUP \
  --output table
```

### Event-Driven Job (Queue Processor)

**Use case:** Process Azure Storage Queue messages, Service Bus messages

```bash
# Create storage account and queue
STORAGE_ACCOUNT="jobstorage$(date +%s)"
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

az storage queue create \
  --name processing-queue \
  --connection-string "$STORAGE_CONNECTION_STRING"

# Create event-driven job
az containerapp job create \
  --name queue-processor-job \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --trigger-type Event \
  --replica-timeout 1800 \
  --replica-retry-limit 2 \
  --min-executions 0 \
  --max-executions 10 \
  --polling-interval 30 \
  --scale-rule-name azure-queue-rule \
  --scale-rule-type azure-queue \
  --scale-rule-metadata \
    "accountName=$STORAGE_ACCOUNT" \
    "queueName=processing-queue" \
    "queueLength=1" \
  --scale-rule-auth "connection=storage-connection" \
  --secrets "storage-connection=$STORAGE_CONNECTION_STRING" \
  --image ${ACR_NAME}.azurecr.io/queue-processor:latest \
  --registry-server ${ACR_NAME}.azurecr.io \
  --registry-identity system \
  --cpu 0.25 \
  --memory 0.5Gi

# Job automatically scales based on queue depth
# Add messages to queue to trigger execution
az storage message put \
  --queue-name processing-queue \
  --content "test message" \
  --connection-string "$STORAGE_CONNECTION_STRING"
```

---

## Infrastructure as Code (Bicep)

### Container App Template

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: projectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'db-connection'
          value: databaseConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: projectName
          image: '${containerRegistry.properties.loginServer}/${projectName}:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'db-connection'
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}
```

### Container Apps Job Template (Scheduled)

```bicep
resource containerAppJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${projectName}-job'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 1800
      replicaRetryLimit: 3
      scheduleTriggerConfig: {
        cronExpression: '0 0 * * *'  // Daily at midnight UTC
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'api-key'
          value: apiKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: '${projectName}-job'
          image: '${containerRegistry.properties.loginServer}/${projectName}-job:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'JOB_TYPE'
              value: 'scheduled'
            }
            {
              name: 'API_KEY'
              secretRef: 'api-key'
            }
          ]
        }
      ]
    }
  }
}
```

### Event-Driven Job Template

```bicep
resource eventDrivenJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${projectName}-queue-job'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      triggerType: 'Event'
      replicaTimeout: 1800
      replicaRetryLimit: 2
      eventTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
        scale: {
          minExecutions: 0
          maxExecutions: 10
          pollingInterval: 30
          rules: [
            {
              name: 'azure-queue-rule'
              type: 'azure-queue'
              metadata: {
                accountName: storageAccountName
                queueName: queueName
                queueLength: '1'
              }
              auth: [
                {
                  secretRef: 'storage-connection-string'
                  triggerParameter: 'connection'
                }
              ]
            }
          ]
        }
      }
      secrets: [
        {
          name: 'storage-connection-string'
          value: storageConnectionString
        }
      ]
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: '${projectName}-queue-processor'
          image: '${containerRegistry.properties.loginServer}/${projectName}-processor:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'STORAGE_CONNECTION'
              secretRef: 'storage-connection-string'
            }
          ]
        }
      ]
    }
  }
}
```

---

## Configuration & Environment Variables

### Set Environment Variables

```bash
# Set env vars (plain text)
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "NODE_ENV=production" "LOG_LEVEL=info"

# Set secrets and reference in env vars
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --secrets "api-key=$API_KEY" \
  --set-env-vars "API_KEY=secretref:api-key"

# List env vars
az containerapp show \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.template.containers[0].env
```

### Update Container Image

```bash
# Build and push new version
az acr build \
  --registry $ACR_NAME \
  --image $PROJECT_NAME:v2 \
  .

# Update container app with new image
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --image ${ACR_NAME}.azurecr.io/${PROJECT_NAME}:v2
```

---

## Scaling Configuration

### Auto-scaling Rules

```bash
# HTTP concurrency-based scaling
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1 \
  --max-replicas 10 \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50

# CPU-based scaling
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --scale-rule-name cpu-rule \
  --scale-rule-type cpu \
  --scale-rule-metadata "type=Utilization" \
  --scale-rule-metadata "value=70"

# Memory-based scaling
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --scale-rule-name memory-rule \
  --scale-rule-type memory \
  --scale-rule-metadata "type=Utilization" \
  --scale-rule-metadata "value=80"

# Azure Queue-based scaling
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --scale-rule-name queue-rule \
  --scale-rule-type azure-queue \
  --scale-rule-metadata "queueName=myqueue" \
  --scale-rule-metadata "queueLength=5" \
  --scale-rule-auth "connection=queue-connection"
```

---

## Monitoring & Logs

### View Logs

```bash
# Stream console logs
az containerapp logs show \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow

# View logs for specific replica
az containerapp logs show \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --replica <replica-name>

# View job execution logs
az containerapp job execution logs show \
  --name migration-job \
  --resource-group $RESOURCE_GROUP \
  --execution-name <execution-name>
```

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app ${PROJECT_NAME}-insights \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

# Get connection string
APPINSIGHTS_CONNECTION=$(az monitor app-insights component show \
  --app ${PROJECT_NAME}-insights \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Configure container app
az containerapp update \
  --name $PROJECT_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION"
```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Validate Docker first** | Always verify Docker is running with `docker ps` before deployment |
| **Use managed identity** | Prefer managed identity over passwords for ACR and Azure resources |
| **Health probes** | Implement `/health` endpoint for liveness and readiness checks |
| **Resource limits** | Set appropriate CPU/memory limits to prevent OOM errors |
| **Scale-to-zero** | Use min-replicas=0 for dev/test to reduce costs |
| **Secrets management** | Store sensitive data in secrets, not environment variables |
| **Log Analytics** | Enable for centralized logging and diagnostics |
| **Auto-scaling** | Configure scale rules based on actual load patterns |
| **Container optimization** | Use multi-stage builds and Alpine images for smaller size |
| **Job timeouts** | Set appropriate `replicaTimeout` for job execution limits |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Docker not running** | Start Docker Desktop and verify with `docker ps` |
| **Image pull errors** | Verify ACR credentials and managed identity has AcrPull role |
| **Port mismatch** | Ensure target-port matches application listening port |
| **Container crashes** | Check logs with `az containerapp logs show`, verify resource limits |
| **Can't reach app** | Verify ingress is external and check firewall rules |
| **Scaling not working** | Review scale rules and check metrics in Azure Portal |
| **Job not triggering** | Verify cron expression syntax (5 fields, UTC timezone) |
| **Job execution fails** | Check job execution logs, verify container exits with code 0 |
| **Event-driven job not scaling** | Verify scale rule metadata, secrets, and queue has messages |
| **Timeout errors** | Increase `replicaTimeout` value in job configuration |

**Debug commands:**
```bash
# Show container app details
az containerapp show --name <app> --resource-group <rg>

# List revisions
az containerapp revision list --name <app> --resource-group <rg>

# List job executions
az containerapp job execution list --name <job> --resource-group <rg>

# Show specific execution
az containerapp job execution show \
  --name <job> \
  --resource-group <rg> \
  --execution-name <execution-name>
```

---

## Cleanup

```bash
# Delete container app
az containerapp delete --name <app> --resource-group <rg> --yes

# Delete job
az containerapp job delete --name <job> --resource-group <rg> --yes

# Delete entire resource group
az group delete --name <rg> --yes --no-wait
```
