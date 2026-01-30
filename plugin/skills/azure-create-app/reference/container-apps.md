# Azure Container Apps Deployment Guide

Complete reference for deploying containerized applications to Azure Container Apps and Container Apps Jobs using Azure MCP tools and azd.

---

## Overview

Azure Container Apps is a fully managed serverless container platform that enables you to run microservices and containerized applications without managing complex infrastructure. This guide provides automated deployment workflows using Azure MCP tools for infrastructure planning, generation, validation, and monitoring.

**Key Benefits:**
- **Serverless containers** - No VM management, auto-scaling to zero
- **Built-in HTTPS** - Automatic ingress with managed certificates
- **Multiple triggers** - HTTP, scheduled jobs, event-driven scaling
- **Microservices ready** - Service-to-service communication via DNS
- **Integrated monitoring** - Built-in Log Analytics and Azure Monitor
- **MCP tool integration** - Automated planning, IaC generation, and validation

**When to use Container Apps:**

### Long-Running Services (Container Apps)
- **Full-stack web applications** - Deploy complete apps with frontend (HTML/React/Vue/Angular) and backend (Node.js/Python/Java) as separate containers
- **Todo apps, blogs, e-commerce sites** - Any web application with a UI and API service layer
- **Single-page applications (SPA) with APIs** - Frontend serving static files + backend API container
- **Microservices** - Deploy multiple containerized services with inter-service communication
- **RESTful APIs** - Host APIs with auto-scaling and ingress configuration
- **Background workers** - Run asynchronous job processors without ingress
- **Event-driven apps** - Build applications that scale based on queue depth or custom metrics

### Finite-Duration Tasks (Container Apps Jobs)
- **Scheduled tasks** - Run recurring jobs on a cron schedule (e.g., daily reports, cleanup tasks)
- **Batch processing** - Process large datasets in parallel with finite execution
- **Data pipelines** - ETL jobs, data transformation, and migration tasks
- **Queue processors** - Process messages from Azure Storage Queues or Service Bus
- **On-demand tasks** - Manual execution for one-time operations or maintenance
- **CI/CD runners** - Self-hosted GitHub Actions or Azure Pipelines agents
- **Machine learning** - Training jobs, model evaluation, and batch inference

**Deployment Workflow:**
```
Prerequisites → Plan → Generate IaC → Validate → Deploy → Monitor
     ↑                                                      │
     └──────────────────────────────────────────────────────┘
```

---

## Prerequisites and Validation

### Pattern 0: Prerequisites Validation

**Always validate all prerequisites before starting deployment to avoid common failures.**

The most common failure is attempting to build container images when Docker daemon is not started.

```javascript
async function validatePrerequisites() {
  const checks = [];
  
  // Check Docker is installed and running
  try {
    await exec('docker ps');
    checks.push({ name: 'Docker', status: 'running' });
  } catch (error) {
    if (error.message.includes('daemon is not running')) {
      throw new Error('Docker Desktop is not running. Please start Docker Desktop and try again.');
    }
    throw new Error('Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop');
  }
  
  // Check Azure Developer CLI authentication
  try {
    await exec('azd auth login --check-status');
    checks.push({ name: 'Azure Developer CLI', status: 'authenticated' });
  } catch (error) {
    throw new Error('Not authenticated with Azure Developer CLI. Run: azd auth login');
  }
  
  // Check Azure location is set
  try {
    const location = process.env.AZURE_LOCATION;
    if (!location) {
      throw new Error('AZURE_LOCATION not set. Run: azd env set AZURE_LOCATION eastus');
    }
    checks.push({ name: 'Azure Location', status: location });
  } catch (error) {
    throw error;
  }
  
  return checks;
}
```

### Prerequisites Checklist

**Setup:**
- [ ] Azure subscription created
- [ ] **Docker Desktop installed and running** (`docker ps`)
- [ ] Azure Developer CLI (azd) installed (`azd version`)
- [ ] Azure Developer CLI authenticated (`azd auth login`)
- [ ] Azure location configured (`azd env set AZURE_LOCATION eastus`)
- [ ] Application containerized with Dockerfile
- [ ] **For full-stack apps**: Verify both frontend and backend can be containerized together or separately

### Required Tools

**Azure Developer CLI (azd):**
```bash
# macOS
brew install azd

# Windows
winget install Microsoft.Azd

# Linux
curl -fsSL https://aka.ms/install-azd.sh | bash
```

**Docker Desktop:**
```bash
# Verify Docker is running
docker version

# Test Docker works
docker run hello-world
```

**Azure CLI (for queries only):**
```bash
# macOS
brew install azure-cli

# Windows
winget install Microsoft.AzureCLI
```

### Authentication

```bash
# Login to Azure
az login

# Verify subscription
az account show --query "{name:name, id:id}" -o table

# Set subscription if needed
az account set --subscription "<name-or-id>"
```

---

## MCP Tools Available

### azd-Specific MCP Tools

Use the Azure MCP server's azd tools (`azure__azd`) for validation and guidance:

| Command | Description |
|---------|-------------|
| `validate_azure_yaml` | **Validates azure.yaml against official JSON schema** - Use before deployment |
| `discovery_analysis` | Analyze application components for AZD migration |
| `architecture_planning` | Select Azure services for discovered components |
| `docker_generation` | Generate optimized Dockerfiles for Container Apps |
| `infrastructure_generation` | Generate Bicep templates |
| `iac_generation_rules` | Get Bicep compliance rules and best practices |
| `project_validation` | Comprehensive validation before deployment |
| `error_troubleshooting` | Diagnose and troubleshoot azd errors |

### Deployment Planning Tools

Use the `azure__deploy` hierarchical tool with these commands for automated Container Apps deployment:

| Command | Description | Parameters |
|---------|-------------|------------|
| `deploy_plan_get` | Generate deployment plan for Container Apps | `workspace-folder`, `project-name`, `target-app-service: "ContainerApp"` |
| `deploy_iac_rules_get` | Get Bicep/Terraform guidelines for Container Apps | `deployment-tool: "AZD"`, `iac-type: "bicep"`, `resource-types: "containerapp"` |
| `deploy_app_logs_get` | Fetch logs from deployed Container Apps | `workspace-folder`, `azd-env-name`, `limit` |
| `deploy_pipeline_guidance_get` | Get CI/CD pipeline guidance | `use-azd-pipeline-config: true`, `subscription` |
| `deploy_architecture_diagram_generate` | Generate architecture diagram | `workspaceFolder`, `projectName`, `services` |

### Pattern 1: Deployment Planning

Generate a deployment plan by analyzing your workspace and recommending Azure resources.

```javascript
async function planDeployment(workspaceFolder: string, projectName: string) {
  // Generate deployment plan
  const plan = await azure__deploy({
    intent: "Generate deployment plan for container app",
    command: "deploy_plan_get",
    parameters: {
      "workspace-folder": workspaceFolder,
      "project-name": projectName,
      "target-app-service": "ContainerApp",
      "provisioning-tool": "AZD",
      "azd-iac-options": "bicep"
    }
  });
  
  // Plan saved to: .azure/plan.copilotmd
  return plan;
}
```

**Key insight**: The deployment plan detects services, dependencies, and recommends Azure resources before any infrastructure is created.

### Pattern 2: Infrastructure as Code Generation

Retrieve IaC best practices and generate Bicep files for Container Apps deployment.

```javascript
async function generateInfrastructure(projectName: string) {
  // Get IaC rules
  const rules = await azure__deploy({
    intent: "Get IaC rules",
    command: "deploy_iac_rules_get",
    parameters: {
      "deployment-tool": "AZD",
      "iac-type": "bicep",
      "resource-types": "containerapp"
    }
  });
  
  // Get Bicep schema (uses latest API version automatically)
  const schema = await azure__bicepschema({
    intent: "Get Container Apps schema",
    command: "bicepschema_get",
    parameters: {
      "resource-type": "Microsoft.App/containerApps"
    }
  });
  
  // Generate main.bicep based on schema and rules
  // Files created: infra/main.bicep, infra/main.parameters.json, azure.yaml
}
```

**Key insight**: Always validate infrastructure before deploying using preview commands (`azd provision --preview`) to catch configuration issues early.

### Pattern 3: Deployment Validation

Monitor and validate deployments using application logs and health checks.

```javascript
async function validateDeployment(workspaceFolder: string, envName: string) {
  // Get application logs
  const logs = await azure__deploy({
    intent: "Get deployment logs",
    command: "deploy_app_logs_get",
    parameters: {
      "workspace-folder": workspaceFolder,
      "azd-env-name": envName,
      "limit": 200
    }
  });
  
  // Check for errors in logs
  const hasErrors = logs.some(log => log.includes("error") || log.includes("exception"));
  
  if (hasErrors) {
    throw new Error("Deployment validation failed - errors found in logs");
  }
  
  return { status: "success", logs };
}
```

### Regional Validation

Check quota and availability before deploying to avoid failures.

```javascript
async function checkRegionalCapacity(subscription: string, location: string) {
  const availability = await azure__quota({
    intent: "Check availability",
    command: "quota_region_availability_list",
    parameters: {
      subscription,
      "resource-type": "Microsoft.App/containerApps"
    }
  });
  
  return availability.regions.includes(location);
}
```

### Architecture Visualization

Generate diagrams to understand service dependencies before deployment.

```javascript
async function visualizeArchitecture(workspaceFolder: string, services: Array) {
  return await azure__deploy({
    intent: "Generate architecture diagram",
    command: "deploy_architecture_diagram_generate",
    parameters: {
      workspaceFolder,
      projectName: "myapp",
      services
    }
  });
}
```

### CI/CD Automation

Get pipeline configuration guidance for automated deployments.

```javascript
async function setupCICD(subscription: string) {
  return await azure__deploy({
    intent: "Get CI/CD guidance",
    command: "deploy_pipeline_guidance_get",
    parameters: {
      "use-azd-pipeline-config": true,
      subscription
    }
  });
}
```

---

## Deployment Workflows

### Multi-Service Deployment (Full-Stack Apps)

Deploy full-stack applications with both frontend and backend services in the same Container Apps environment.

```javascript
async function deployFullStackApp(projectName: string) {
  // Project structure:
  // /web       - Frontend (HTML/CSS/JS or React/Vue)
  // /api       - Backend (Node.js/Python/Java)
  // /Dockerfile - Multi-stage build or separate Dockerfiles
  
  const services = [
    {
      name: `${projectName}-web`,
      path: './web',
      language: 'JavaScript',
      type: 'frontend',
      ingress: {
        external: true,
        targetPort: 80,
        allowInsecure: false
      }
    },
    {
      name: `${projectName}-api`,
      path: './api',
      language: 'JavaScript',
      type: 'backend',
      ingress: {
        external: true,  // or false if only internal access
        targetPort: 3000,
        allowInsecure: false
      },
      env: [
        { name: 'NODE_ENV', value: 'production' }
      ]
    }
  ];
  
  // Generate deployment plan for multi-service app
  const plan = await azure__deploy({
    intent: "Generate deployment plan for full-stack app",
    command: "deploy_plan_get",
    parameters: {
      "workspace-folder": process.cwd(),
      "project-name": projectName,
      "target-app-service": "ContainerApp",
      "provisioning-tool": "AZD",
      "azd-iac-options": "bicep"
    }
  });
  
  // For single Dockerfile serving both UI and API:
  // - Frontend files served as static from /web
  // - Backend API exposed on /api/* routes
  // - Single container app with one ingress
  
  return { plan, services };
}
```

**Key insight**: For simple full-stack apps (like todo apps), you can use a single container where the backend serves both the API routes and the static frontend files. For more complex apps, deploy separate container apps for frontend and backend.

**Architecture Options:**
1. **Single Container**: Backend serves static frontend files + API (simpler, good for small apps)
2. **Two Containers**: Separate UI and API containers (better for larger apps, independent scaling)
3. **Microservices**: Multiple backend services + frontend (enterprise applications)

---

## MCP Tools Used

---

## Project Structure Detection

### Containerization Signals

azd will recommend Container Apps when it detects:

**Strong indicators:**
- `Dockerfile` in project root or service directories
- `docker-compose.yml` with multiple services
- `.dockerignore` file present
- User mentions "container", "Docker", "scheduled task", "cron job"

**Multi-container patterns:**
```
project/
├── frontend/
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
└── azure.yaml (generated by azd)
```

---

## Deployment Workflow

### Step 1: Initialize azd Project

**From scratch:**
```bash
# Navigate to project directory
cd my-app

# Initialize with azd
azd init

# Choose Container Apps template
# azd will detect your Dockerfile(s) and configure automatically
```

**Using a template:**
```bash
# List available templates
azd template list --filter container

# Initialize from template
azd init --template todo-nodejs-mongo-aca
```

### Step 2: Review azure.yaml Configuration

azd generates `azure.yaml` that defines your application:

```yaml
name: my-containerized-app
metadata:
  template: azd-init@1.0.0
services:
  web:
    project: ./frontend
    language: js
    host: containerapp
    docker:
      path: ./Dockerfile
      context: ./frontend
  api:
    project: ./backend
    language: python
    host: containerapp
    docker:
      path: ./Dockerfile
      context: ./backend
```

**Configuration options:**

| Field | Description | Example |
|-------|-------------|---------|
| `host: containerapp` | Deploy as Container App | Required |
| `docker.path` | Path to Dockerfile | `./Dockerfile` |
| `docker.context` | Docker build context | `.` or `./backend` |
| `docker.target` | Multi-stage build target | `production` |

### Step 3: Configure Infrastructure (Optional)

azd creates `infra/` directory with Bicep templates. You can customize:

**Container App configuration (`infra/main.bicep`):**
```bicep
module containerApp 'core/host/container-app.bicep' = {
  name: 'container-app'
  params: {
    name: 'my-app'
    location: location
    containerAppsEnvironmentId: containerAppsEnvironment.outputs.id
    containerRegistryName: containerRegistry.outputs.name
    secrets: [
      {
        name: 'database-connection-string'
        value: database.outputs.connectionString
      }
    ]
    env: [
      {
        name: 'DATABASE_URL'
        secretRef: 'database-connection-string'
      }
      {
        name: 'NODE_ENV'
        value: 'production'
      }
    ]
    ingress: {
      external: true
      targetPort: 3000
      allowInsecure: false
    }
    scale: {
      minReplicas: 1
      maxReplicas: 10
      rules: [
        {
          name: 'http-rule'
          http: {
            metadata: {
              concurrentRequests: '100'
            }
          }
        }
      ]
    }
  }
}
```

**Using Azure Verified Modules:**
```bicep
module containerApp 'br/public:avm/res/app/container-app:0.4.0' = {
  name: 'containerAppDeployment'
  params: {
    name: 'my-app'
    environmentId: containerAppsEnvironment.outputs.resourceId
    containers: [
      {
        name: 'main'
        image: '${containerRegistry.outputs.loginServer}/my-app:latest'
        resources: {
          cpu: json('0.5')
          memory: '1.0Gi'
        }
      }
    ]
  }
}
```

### Step 4: Deploy

**Deploy everything (provision + deploy code):**
```bash
# Interactive deployment
azd up

# Non-interactive with environment (for automation/agents)
azd up --no-prompt --environment production
```

> ⚠️ **CRITICAL for automation**: Always use `--no-prompt` when azd is called by an agent or in CI/CD pipelines where interactive prompts cannot be answered.

**Or deploy in steps:**
```bash
# 1. Preview changes before provisioning
azd provision --preview

# 2. Provision infrastructure only (with --no-prompt for automation)
azd provision --no-prompt

# 3. Build and deploy containers
azd deploy --no-prompt

# 4. Deploy specific service
azd deploy api --no-prompt
```

**Validate azure.yaml before deployment:**
```javascript
// Use MCP tool to validate azure.yaml
const validation = await azure__azd({
  command: "validate_azure_yaml",
  parameters: { path: "./azure.yaml" }
});
```

**What azd does automatically:**
1. ✅ Provisions Container Apps Environment
2. ✅ Creates Azure Container Registry (ACR)
3. ✅ Builds Docker images locally
4. ✅ Pushes images to ACR using managed identity
5. ✅ Deploys containers to Container Apps
6. ✅ Configures ingress, scaling, and environment variables
7. ✅ Sets up Log Analytics workspace

---

## Container Apps Features

### Ingress Configuration

**External ingress (public internet):**
```bicep
ingress: {
  external: true
  targetPort: 8080
  allowInsecure: false  // HTTPS only
  transport: 'auto'     // HTTP/1 and HTTP/2
}
```

**Internal ingress (within environment):**
```bicep
ingress: {
  external: false
  targetPort: 3000
  allowInsecure: false
}
```

**Custom domain:**
```bicep
customDomains: [
  {
    name: 'api.contoso.com'
    certificateId: certificate.id
    bindingType: 'SniEnabled'
  }
]
```

#---

## Azure Resources Reference

### Core Resources for Container Apps

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.App/containerApps` | Container App instance (long-running services) | 2024-03-01 |
| `Microsoft.App/jobs` | Container Apps Job (finite-duration tasks) | 2024-03-01 |
| `Microsoft.App/managedEnvironments` | Container Apps Environment (shared infrastructure) | 2024-03-01 |
| `Microsoft.ContainerRegistry/registries` | Container Registry (ACR) for image storage | 2023-11-01-preview |
| `Microsoft.OperationalInsights/workspaces` | Log Analytics for monitoring and diagnostics | 2023-09-01 |

### Example Bicep Template - Container App

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
        targetPort: 80
        transport: 'auto'
        allowInsecure: false
      }
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
          name: projectName
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
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
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}
```

### Example Bicep Templates - Container Apps Jobs

**Scheduled Job (Cron):**

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
      triggerType: 'Schedule'  // Options: Manual, Schedule, Event
      replicaTimeout: 1800  // 30 minutes
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
    }
    template: {
      containers: [
        {
          name: '${projectName}-job'
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'JOB_TYPE'
              value: 'scheduled'
            }
          ]
        }
      ]
    }
  }
}
```

**Event-Driven Job (Queue Trigger):**

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
      replicaTimeout: 1800  // 30 minutes
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
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
}
```

**Manual Job (On-Demand):**

```bicep
resource manualJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${projectName}-manual-job'
  location: location
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 3600  // 1 hour
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
    }
    template: {
      containers: [
        {
          name: 'migration'
          image: containerImage
        }
      ]
    }
  }
}
```

**Start manual job:**
```bash
az containerapp job start \
  --name "${projectName}-manual-job" \
  --resource-group my-rg
```

---

## Environment Variables and Secrets

**HTTP-based scaling:**
```bicep
scale: {
  minReplicas: 0  // Scale to zero when idle
  maxReplicas: 30
  rules: [
    {
      name: 'http-scaling'
      http: {
        metadata: {
          concurrentRequests: '100'
        }
      }
    }
  ]
}
```

**Custom scaler (KEDA):**
```bicep
scale: {
  minReplicas: 1
  maxReplicas: 10
  rules: [
    {
      name: 'azure-queue-scaler'
      azureQueue: {
        queueName: 'orders'
        queueLength: 10
        auth: [
          {
            secretRef: 'storage-connection-string'
            triggerParameter: 'connection'
          }
        ]
      }
    }
  ]
}
```

**Supported KEDA scalers:**
- Azure Service Bus Queue/Topic
- Azure Storage Queue
- Azure Event Hubs
- HTTP (polling external endpoint)
- CPU/Memory metrics
- Cron (scheduled scaling)

### Environment Variables and Secrets

**Environment variables:**
```bicep
env: [
  {
    name: 'API_BASE_URL'
    value: 'https://api.contoso.com'
  }
  {
    name: 'LOG_LEVEL'
    value: 'info'
  }
]
```

**Secrets (from Key Vault):**
```bicep
secrets: [
  {
    name: 'database-password'
    keyVaultUrl: '${keyVault.properties.vaultUri}secrets/db-password'
    identity: managedIdentity.id
  }
]
env: [
  {
    name: 'DATABASE_PASSWORD'
    secretRef: 'database-password'
  }
]
```

**Secrets (from values):**
```bicep
secrets: [
  {
    name: 'api-key'
    value: apiKeySecretValue
  }
]
env: [
  {
    name: 'API_KEY'
    secretRef: 'api-key'
  }
]
```

---

## Scaling Configuration

**Service-to-service calls within environment:**

Frontend → Backend communication:
```javascript
// Frontend container calling backend
// Use internal FQDN: <app-name>.<environment-name>.internal
const API_URL = process.env.API_INTERNAL_URL || 
  'http://api.my-env.internal';

fetch(`${API_URL}/api/users`)
  .then(res => res.json());
```

**Dapr integration:**
```bicep
dapr: {
  enabled: true
  appId: 'backend-api'
  appPort: 3000
  appProtocol: 'http'
}
```

Frontend calling backend via Dapr:
```javascript
const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const response = await fetch(
  `http://localhost:${daprPort}/v1.0/invoke/backend-api/method/users`
);
```

---

## Dockerfile Best Practices

### Node.js Dockerfile Example

```dockerfile
# Multi-stage build for smaller images
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build if needed
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

# Expose port (must match Container App ingress.targetPort)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
```

### Python Dockerfile Example

```dockerfile
FROM python:3.12-slim AS builder

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:3.12-slim AS production

# Run as non-root
RUN useradd -m -u 1001 appuser

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /root/.local /home/appuser/.local
COPY --chown=appuser:appuser . .

USER appuser

# Add local bin to PATH
ENV PATH=/home/appuser/.local/bin:$PATH

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### .NET Dockerfile Example

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

# Copy csproj and restore
COPY ["MyApp.csproj", "./"]
RUN dotnet restore

# Copy source and build
COPY . .
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final

WORKDIR /app
COPY --from=publish /app/publish .

# Run as non-root
USER $APP_UID

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### Dockerfile Optimization Tips

**1. Use multi-stage builds** - Keep images small
**2. Run as non-root user** - Security best practice
**3. Add health checks** - Container Apps will use these
**4. Use .dockerignore** - Faster builds, smaller context

**.dockerignore example:**
```
node_modules
npm-debug.log
.git
.gitignore
.env
.vscode
*.md
Dockerfile
.dockerignore
dist
build
coverage
```

---

## Monitoring and Logging

### View Logs with azd

```bash
# Stream logs from specific service
azd deploy api --logs

# Or use Azure CLI
az containerapp logs show \
  --name api \
  --resource-group my-rg \
  --follow
```

### Query Logs with Log Analytics

```kusto
// Container logs
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == 'api'
| where TimeGenerated > ago(1h)
| project TimeGenerated, Log_s
| order by TimeGenerated desc

// System logs
ContainerAppSystemLogs_CL
| where ContainerAppName_s == 'api'
| where TimeGenerated > ago(1h)
| project TimeGenerated, Log_s

// Ingress logs (HTTP requests)
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == 'api'
| where Log_s contains "HTTP"
| extend StatusCode = extract(@"HTTP/\d\.\d\" (\d+)", 1, Log_s)
| summarize count() by StatusCode, bin(TimeGenerated, 5m)
```

### Application Insights Integration

Add to your Bicep:
```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'app-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

// Add to Container App env
env: [
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsights.properties.ConnectionString
  }
]
```

---

## Troubleshooting

### Container App Won't Start

**Check revision status:**
```bash
az containerapp revision list \
  --name my-app \
  --resource-group my-rg \
  --query "[].{Name:name, Active:properties.active, ProvisioningState:properties.provisioningState}"
```

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Docker not running** | Error: "Docker daemon is not running" | Start Docker Desktop. Windows: Search for Docker Desktop in Start menu. macOS: Open Docker Desktop from Applications. Verify with `docker ps` |
| **Docker not installed** | Error: "docker: command not found" | Install Docker Desktop from https://www.docker.com/products/docker-desktop |
| **Not authenticated** | Error: "authentication required" | Run `az login` and `azd auth login` to authenticate with Azure |
| **Location not set** | Error: "location property must be specified" | Set location: `azd env set AZURE_LOCATION eastus` |
| **Image pull failures** | Container fails to start | Check ACR is accessible. Verify managed identity has AcrPull role. Ensure image tag is correct. Run: `az containerapp registry set --name APP -g RG --server ACR.azurecr.io --identity system` |
| **ACR Tasks disabled** | `az acr build` fails with "TasksOperationsNotAllowed" | Free/trial subscriptions have ACR Tasks disabled. Build locally: `docker build`, `az acr login`, `docker push` |
| **Container crashes immediately** | Container exits right after starting | Check logs: `az containerapp logs show --name my-app --resource-group my-rg`. Verify health check endpoint exists. Check environment variables are set correctly |
| **Port mismatch** | App not accessible after deployment | Ensure `EXPOSE` in Dockerfile matches `ingress.targetPort` in Bicep. Application must listen on correct port |
| **Health check failures** | Container marked unhealthy | Verify `/health` endpoint returns 200 OK. Check startup time isn't exceeding timeout. Adjust probe timings if needed |
| **Bicep validation errors** | Error during `azd provision` | Use `get_errors` tool on Bicep files to identify syntax issues |
| **User/group already exists** | Dockerfile build fails with "group in use" | Base images may have users pre-configured. Check if user exists before creating in Dockerfile |
| **Cold start timeouts** | First request times out after idle period | Set minimum replicas to prevent cold starts: `az containerapp update --name APP -g RG --min-replicas 1` |
| **Out of memory** | Container crashes or restarts frequently | Increase memory limits in Bicep configuration or `resources` section |
| **Missing env vars** | Application errors on startup | Configure environment variables in container app settings or Bicep template |
| **Job execution timeout** | Job fails with timeout error | Increase `replicaTimeout` value (default 1800s, max varies by plan) |
| **Job not triggering** | Scheduled job doesn't run at expected time | Verify cron expression syntax. Remember times are in UTC timezone. Check logs for execution history |
| **Event-driven job not scaling** | Queue messages not being processed | Check scale rule configuration, verify secrets and connection strings are correct. Test queue connectivity |
| **Job replica failures** | Job keeps failing and retrying | Check logs with `az containerapp job execution list`. Verify container exits with code 0 on success. Review retry limits |
| **Invalid cron expression** | Job creation fails with validation error | Use standard 5-field cron format: `minute hour day-of-month month day-of-week` |

### Performance Issues

**Check replica count:**
```bash
az containerapp show \
  --name my-app \
  --resource-group my-rg \
  --query "properties.template.scale"
```

**Adjust scaling rules:**
- Increase `maxReplicas` for more capacity
- Decrease `concurrentRequests` to scale out sooner
- Add CPU/memory-based scaling if needed

### Deployment Failures

**azd deploy fails:**
```bash
# Check azd logs
azd deploy --debug

# Verify Docker is running
docker version

# Test Docker build locally
docker build -t test .

# Check Azure subscription
az account show
```

**ACR authentication issues:**
```bash
# Login to ACR manually
az acr login --name <registry-name>

# Verify managed identity has AcrPull role
az role assignment list \
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.ContainerRegistry/registries/<acr-name> \
  --query "[?principalId=='<identity-id>']"
```

---

## Cost Optimization

**Scale to zero:**
```bicep
scale: {
  minReplicas: 0  // No cost when idle
  maxReplicas: 10
}
```

**Right-size containers:**
```bicep
resources: {
  cpu: json('0.25')     // 0.25 vCPU
  memory: '0.5Gi'       // 512 MB
}
```

**Use Consumption plan (default):**
- Pay only for what you use
- Billed per vCPU-second and GB-second
- Includes monthly free grant

**Monitor costs:**
```bash
# View resource costs
az consumption usage list \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --query "[?contains(instanceName, 'my-app')]"
```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Validate Docker first** | Always verify Docker is running with `docker ps` before starting deployment to avoid build failures |
| **Use managed identity** | Always prefer managed identity over key-based authentication for secure resource access |
| **Preview before deploy** | Run `azd provision --preview` to validate infrastructure changes before deploying |
| **Test locally** | Build and test Docker images locally with `docker build` before pushing to Azure Container Registry |
| **Port matching** | Ensure `ingress.targetPort` in configuration matches the port your application listens on (must match Dockerfile `EXPOSE`) |
| **Structured logging** | Enable Application Insights and Log Analytics for centralized monitoring and troubleshooting |
| **Health probes** | Configure liveness and readiness probes for reliability. Implement `/health` endpoint in your app |
| **Auto-scaling** | Set min/max replica counts based on expected workload patterns. Set min=0 for cost savings, min=1 to prevent cold starts |
| **Use multi-stage builds** | Keep Docker images small by using multi-stage builds and only copying necessary files to production stage |
| **Run as non-root** | Always run containers as non-root user for security. Create dedicated user in Dockerfile |
| **Environment-specific config** | Use azd environments for dev/staging/production. Store secrets in Key Vault, not in code |
| **Resource right-sizing** | Start with small CPU/memory allocations (0.25 vCPU, 0.5Gi) and scale up based on monitoring data |
| **Job timeout planning** | Set realistic `replicaTimeout` values for jobs. Monitor execution times and adjust accordingly |
| **UTC timezone awareness** | Remember all cron schedules run in UTC. Adjust expressions for your local timezone |
| **Container exit codes** | Ensure jobs exit with code 0 on success. Non-zero codes trigger retries and failures |

---

## Security Best Practices

### 1. Use Managed Identity

**Never store credentials in code or environment variables:**

```bicep
identity: {
  type: 'SystemAssigned'
}

// Grant access to Key Vault
resource keyVaultPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-02-01' = {
  parent: keyVault
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: containerApp.identity.principalId
        permissions: {
          secrets: ['get']
        }
      }
    ]
  }
}
```

### 2. Store Secrets in Key Vault

```bicep
secrets: [
  {
    name: 'database-password'
    keyVaultUrl: '${keyVault.properties.vaultUri}secrets/db-password'
    identity: containerApp.identity.id
  }
]
```

### 3. Use Internal Ingress When Possible

```bicep
ingress: {
  external: false  // Only accessible within environment
  targetPort: 3000
}
```

### 4. Enable HTTPS Only

```bicep
ingress: {
  external: true
  allowInsecure: false  // Redirect HTTP to HTTPS
  targetPort: 443
}
```

### 5. Restrict Network Access

```bicep
workloadProfiles: [
  {
    name: 'Consumption'
    workloadProfileType: 'Consumption'
  }
]
vnetConfiguration: {
  infrastructureSubnetId: subnet.id
  internal: true  // No public IP
}
```

---

## Common Patterns

### Pattern 1: Frontend + Backend

```yaml
# azure.yaml
services:
  web:
    project: ./frontend
    host: containerapp
    docker:
      path: ./Dockerfile
      context: ./frontend
  api:
    project: ./backend
    host: containerapp
    docker:
      path: ./Dockerfile
      context: ./backend
```

### Pattern 2: API + Background Job

```yaml
services:
  api:
    project: ./api
    host: containerapp
  worker:
    project: ./worker
    host: containerjob  # Scheduled job
```

### Pattern 3: Microservices with Dapr

```yaml
services:
  orders:
    project: ./services/orders
    host: containerapp
  inventory:
    project: ./services/inventory
    host: containerapp
  notifications:
    project: ./services/notifications
    host: containerapp
```

---

## Next Steps

- See [Azure Verified Modules](./azure-verified-modules.md) for Bicep module reference
- See [Multi-Service Guide](./multi-service.md) for complex deployments
- See [Troubleshooting Guide](./troubleshooting.md) for more help

---

## Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [KEDA Scalers](https://keda.sh/docs/scalers/)
- [Dapr Documentation](https://docs.dapr.io/)
- [azd Templates](https://azure.github.io/awesome-azd/)
