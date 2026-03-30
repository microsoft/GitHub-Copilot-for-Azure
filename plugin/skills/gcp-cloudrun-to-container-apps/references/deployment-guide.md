# Google Cloud Run to Azure Container Apps - Deployment Guide

## Prerequisites

Before starting the deployment, ensure you have:

### Tools Installed
- Azure CLI (`az`) version 2.53.0 or later
- gcloud CLI (for accessing GCP resources)
- Docker (for local testing and image migration)
- jq (for JSON parsing in scripts)

### Azure Resources Ready
- Azure subscription with appropriate permissions
- Resource group created or identified
- Azure Container Registry (ACR) created or identified
- Azure Key Vault (if using secrets)
- Log Analytics workspace

### GCP Access
- gcloud CLI authenticated with read access to:
  - Container Registry (GCR) or Artifact Registry
  - Cloud Run (to read service configurations)
  - Secret Manager (to review secrets structure)

## Phase 1: Container Registry Migration

### Step 1: Authenticate to Registries

```bash
# Google Container Registry (GCR) Login
gcloud auth configure-docker

# Or for Artifact Registry
gcloud auth configure-docker <region>-docker.pkg.dev

# Azure ACR Login
az acr login --name <registry-name>
```

### Step 2: Pull Images from GCR/Artifact Registry

```bash
# Pull from GCR
docker pull gcr.io/<project-id>/<image-name>:<tag>

# Or from Artifact Registry
docker pull <region>-docker.pkg.dev/<project-id>/<repository>/<image-name>:<tag>
```

### Step 3: Tag and Push to ACR

```bash
# Tag for ACR
docker tag gcr.io/<project-id>/<image-name>:<tag> \
  <registry-name>.azurecr.io/<image-name>:<tag>

# Push to ACR
docker push <registry-name>.azurecr.io/<image-name>:<tag>
```

### Automation Script: `migrate-images.sh`

```bash
#!/bin/bash
set -e

# Configuration
GCP_PROJECT_ID="my-project"
GCP_REGION="us-central1"
ACR_NAME="myregistry"
ACR_REGISTRY="${ACR_NAME}.azurecr.io"

# Artifact Registry format
AR_REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/my-repo"

# Array of images to migrate
IMAGES=(
  "my-app:v1.0"
  "my-app:v1.1"
  "worker:latest"
)

# GCP Authentication
echo "Configuring GCP authentication..."
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev

# ACR Login
echo "Logging into Azure ACR..."
az acr login --name $ACR_NAME

# Migrate each image
for image in "${IMAGES[@]}"; do
  echo "Migrating $image..."
  
  # Pull from Artifact Registry
  docker pull "$AR_REGISTRY/$image"
  
  # Tag for ACR
  docker tag "$AR_REGISTRY/$image" "$ACR_REGISTRY/$image"
  
  # Push to ACR
  docker push "$ACR_REGISTRY/$image"
  
  # Clean up local image
  docker rmi "$AR_REGISTRY/$image"
  
  echo "✓ Migrated $image"
done

echo "✓ All images migrated successfully"
```

## Phase 2: Infrastructure Setup

### Step 1: Create Resource Group (if needed)

```bash
az group create \
  --name myapp-rg \
  --location eastus
```

### Step 2: Create Container Apps Environment

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group myapp-rg \
  --workspace-name myapp-logs \
  --location eastus

# Get workspace credentials
LOG_WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group myapp-rg \
  --workspace-name myapp-logs \
  --query customerId -o tsv)

LOG_WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group myapp-rg \
  --workspace-name myapp-logs \
  --query primarySharedKey -o tsv)

# Create Container Apps environment
az containerapp env create \
  --name myapp-env \
  --resource-group myapp-rg \
  --location eastus \
  --logs-workspace-id $LOG_WORKSPACE_ID \
  --logs-workspace-key $LOG_WORKSPACE_KEY
```

### Step 3: Configure Virtual Network (if Cloud Run uses VPC Connector)

```bash
# Create VNet and subnet for Container Apps
az network vnet create \
  --resource-group myapp-rg \
  --name myapp-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name container-apps-subnet \
  --subnet-prefix 10.0.0.0/23

# Get subnet ID
SUBNET_ID=$(az network vnet subnet show \
  --resource-group myapp-rg \
  --vnet-name myapp-vnet \
  --name container-apps-subnet \
  --query id -o tsv)

# Create Container Apps environment with VNet integration
az containerapp env create \
  --name myapp-env \
  --resource-group myapp-rg \
  --location eastus \
  --logs-workspace-id $LOG_WORKSPACE_ID \
  --logs-workspace-key $LOG_WORKSPACE_KEY \
  --infrastructure-subnet-resource-id $SUBNET_ID \
  --internal-only false
```

## Phase 3: Secrets Configuration

### Step 1: Create Azure Key Vault (if needed)

```bash
az keyvault create \
  --name myapp-kv \
  --resource-group myapp-rg \
  --location eastus \
  --enable-rbac-authorization false
```

### Step 2: Migrate Secrets from Google Secret Manager

```bash
# List secrets from GCP (for reference)
gcloud secrets list --project=$GCP_PROJECT_ID

# Get secret value from GCP
SECRET_VALUE=$(gcloud secrets versions access latest \
  --secret=my-secret \
  --project=$GCP_PROJECT_ID)

# Store in Azure Key Vault
az keyvault secret set \
  --vault-name myapp-kv \
  --name my-secret \
  --value "$SECRET_VALUE"
```

### Bulk Secret Migration Script

```bash
#!/bin/bash
set -e

GCP_PROJECT_ID="my-project"
VAULT_NAME="myapp-kv"

# Array of secret names to migrate
SECRETS=(
  "db-password"
  "api-key"
  "jwt-secret"
)

for secret in "${SECRETS[@]}"; do
  echo "Migrating secret: $secret"
  
  # Get from GCP Secret Manager
  value=$(gcloud secrets versions access latest \
    --secret=$secret \
    --project=$GCP_PROJECT_ID)
  
  # Store in Azure Key Vault
  az keyvault secret set \
    --vault-name $VAULT_NAME \
    --name $secret \
    --value "$value" \
    --output none
  
  echo "✓ Migrated $secret"
done

echo "✓ All secrets migrated"
```

### Step 3: Create Managed Identity

```bash
# Create user-assigned managed identity
az identity create \
  --name myapp-identity \
  --resource-group myapp-rg \
  --location eastus

# Get identity details
IDENTITY_ID=$(az identity show \
  --name myapp-identity \
  --resource-group myapp-rg \
  --query id -o tsv)

PRINCIPAL_ID=$(az identity show \
  --name myapp-identity \
  --resource-group myapp-rg \
  --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name myapp-kv \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list

# Grant ACR pull permission
ACR_ID=$(az acr show --name myregistry --query id -o tsv)
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role AcrPull \
  --scope $ACR_ID
```

## Phase 4: Container App Deployment

### Cloud Run to Container Apps Configuration Mapping

#### Original Cloud Run Service (gcloud command)

```bash
gcloud run deploy my-app \
  --image gcr.io/my-project/my-app:v1.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars ENV=production,LOG_LEVEL=info \
  --set-secrets DB_PASSWORD=db-password:latest \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300
```

#### Equivalent Azure Container Apps (az command)

```bash
# Set variables
RG="myapp-rg"
APP_NAME="my-app"
ENVIRONMENT="myapp-env"
IMAGE="myregistry.azurecr.io/my-app:v1.0"

# Get Key Vault secret URI
SECRET_URI=$(az keyvault secret show \
  --vault-name myapp-kv \
  --name db-password \
  --query id -o tsv)

# Create Container App
az containerapp create \
  --name $APP_NAME \
  --resource-group $RG \
  --environment $ENVIRONMENT \
  --image $IMAGE \
  --target-port 8080 \
  --ingress external \
  --cpu 1.0 \
  --memory 1Gi \
  --min-replicas 0 \
  --max-replicas 10 \
  --user-assigned $IDENTITY_ID \
  --registry-identity $IDENTITY_ID \
  --registry-server myregistry.azurecr.io \
  --secrets db-password=keyvaultref:$SECRET_URI,identityref:$IDENTITY_ID \
  --env-vars \
    ENV=production \
    LOG_LEVEL=info \
    DB_PASSWORD=secretref:db-password \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 80
```

### Cloud Run YAML to Container Apps YAML

#### Original Cloud Run Service (YAML)

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-app
  labels:
    cloud.googleapis.com/location: us-central1
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      serviceAccountName: my-service-account@my-project.iam.gserviceaccount.com
      containers:
      - image: gcr.io/my-project/my-app:v1.0
        ports:
        - containerPort: 8080
        env:
        - name: ENV
          value: production
        - name: LOG_LEVEL
          value: info
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-password
              key: latest
        resources:
          limits:
            cpu: "1"
            memory: 512Mi
```

#### Converted Azure Container Apps (YAML)

```yaml
properties:
  managedEnvironmentId: /subscriptions/.../resourceGroups/myapp-rg/providers/Microsoft.App/managedEnvironments/myapp-env
  configuration:
    activeRevisionsMode: single
    ingress:
      external: true
      targetPort: 8080
      transport: auto
      allowInsecure: false
      clientCertificateMode: ignore
    secrets:
      - name: db-password
        keyVaultUrl: https://myapp-kv.vault.azure.net/secrets/db-password
        identity: /subscriptions/.../resourceGroups/myapp-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/myapp-identity
    registries:
      - server: myregistry.azurecr.io
        identity: /subscriptions/.../resourceGroups/myapp-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/myapp-identity
  template:
    containers:
      - name: my-app
        image: myregistry.azurecr.io/my-app:v1.0
        resources:
          cpu: 1.0
          memory: 1Gi
        env:
          - name: ENV
            value: production
          - name: LOG_LEVEL
            value: info
          - name: DB_PASSWORD
            secretRef: db-password
    scale:
      minReplicas: 0
      maxReplicas: 10
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "80"
```

### Deploy with Bicep

Create `main.bicep`:

```bicep
param location string = resourceGroup().location
param appName string
param environmentId string
param image string
param managedIdentityId string
param keyVaultName string

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'db-password'
          keyVaultUrl: 'https://${keyVaultName}.vault.azure.net/secrets/db-password'
          identity: managedIdentityId
        }
      ]
      registries: [
        {
          server: 'myregistry.azurecr.io'
          identity: managedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: image
          resources: {
            cpu: json('1.0')
            memory: '1Gi'
          }
          env: [
            { name: 'ENV', value: 'production' }
            { name: 'LOG_LEVEL', value: 'info' }
            { name: 'DB_PASSWORD', secretRef: 'db-password' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '80'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output latestRevisionName string = containerApp.properties.latestRevisionName
```

Deploy:

```bash
az deployment group create \
  --resource-group myapp-rg \
  --template-file main.bicep \
  --parameters \
    appName=my-app \
    environmentId=$ENV_ID \
    image=myregistry.azurecr.io/my-app:v1.0 \
    managedIdentityId=$IDENTITY_ID \
    keyVaultName=myapp-kv
```

## Phase 5: Advanced Configurations

### Internal-Only Service (Cloud Run VPC Ingress)

If Cloud Run service has `--ingress internal`:

```bash
az containerapp create \
  --name $APP_NAME \
  --resource-group $RG \
  --environment $ENVIRONMENT \
  --image $IMAGE \
  --ingress internal \
  --target-port 8080
```

### Multiple Revisions with Traffic Splitting

Cloud Run supports traffic splitting between revisions:

```bash
# Deploy new revision
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG \
  --image myregistry.azurecr.io/my-app:v2.0

# Split traffic: 90% to old, 10% to new
az containerapp revision set-mode \
  --name $APP_NAME \
  --resource-group $RG \
  --mode multiple

az containerapp ingress traffic set \
  --name $APP_NAME \
  --resource-group $RG \
  --revision-weight latest=10 previous=90
```

### Custom Domains

```bash
# Add custom domain
az containerapp hostname add \
  --name $APP_NAME \
  --resource-group $RG \
  --hostname myapp.example.com

# Bind certificate
az containerapp hostname bind \
  --name $APP_NAME \
  --resource-group $RG \
  --hostname myapp.example.com \
  --certificate <certificate-id>
```

## Phase 6: Validation and Testing

### Check Deployment Status

```bash
# Verify app is running
az containerapp show \
  --name $APP_NAME \
  --resource-group $RG \
  --query properties.runningStatus

# Get endpoint
FQDN=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RG \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Application URL: https://$FQDN"
```

### Test Application Endpoints

```bash
# Health check
curl -I https://$FQDN/

# Test API endpoint
curl https://$FQDN/api/health

# Load test (using hey or similar)
hey -n 1000 -c 50 https://$FQDN/
```

### Verify Secrets and Environment Variables

```bash
# Check environment variables (logs will show them if app logs config)
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RG \
  --tail 20
```

### Monitor Scaling Behavior

```bash
# Watch replica count
watch -n 2 "az containerapp replica list \
  --name $APP_NAME \
  --resource-group $RG \
  --revision latest \
  --query '[].name' -o table"
```

### View Logs

```bash
# Stream container logs
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RG \
  --follow

# Query Log Analytics
az monitor log-analytics query \
  --workspace $LOG_WORKSPACE_ID \
  --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == '$APP_NAME' | project TimeGenerated, Log_s | order by TimeGenerated desc | limit 50"
```

## Troubleshooting

### Image Pull Failures

```bash
# Verify registry configuration
az containerapp show \
  --name $APP_NAME \
  --resource-group $RG \
  --query properties.configuration.registries

# Test ACR access with managed identity
az acr login --name myregistry --identity
```

### Application Not Starting

```bash
# Check revision status
az containerapp revision show \
  --name $APP_NAME \
  --resource-group $RG \
  --revision latest

# View recent logs
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RG \
  --tail 100
```

### Secret Access Issues

```bash
# Check Key Vault access
az keyvault show-policy \
  --name myapp-kv \
  --object-id $PRINCIPAL_ID

# Verify managed identity has secrets/get permission
```

### Timeout Issues (Cloud Run 60m vs Container Apps 30m)

If your Cloud Run service uses timeouts > 30 minutes:

```bash
# Set maximum timeout (1800s = 30 minutes)
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG \
  --set-timeout 1800
```

**Note**: If your workload requires > 30 minutes, consider redesigning as:
- Background job triggered by Azure Queue Storage
- Azure Functions with Durable Functions
- Azure Container Instances (for long-running tasks)

## Post-Deployment Checklist

- [ ] Application responds to HTTP requests
- [ ] All endpoints return expected responses
- [ ] Environment variables configured correctly
- [ ] Secrets accessible from Key Vault
- [ ] Scaling working (scale to zero and scale out)
- [ ] Database connections working
- [ ] Logs flowing to Log Analytics
- [ ] Metrics visible in Azure Monitor
- [ ] Custom domain configured (if needed)
- [ ] SSL certificate valid
- [ ] Performance comparable to Cloud Run
- [ ] Cold start times acceptable
- [ ] Load testing passed
- [ ] Monitoring and alerts configured
