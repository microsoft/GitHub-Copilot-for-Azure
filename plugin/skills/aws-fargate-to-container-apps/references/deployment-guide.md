# AWS Fargate to Azure Container Apps - Deployment Guide

## Prerequisites

Before starting the deployment, ensure you have:

### Tools Installed
- Azure CLI (`az`) version 2.53.0 or later
- Docker (for local testing)
- jq (for JSON parsing in scripts)

### Azure Resources Ready
- Azure subscription with appropriate permissions
- Resource group created or identified
- Azure Container Registry (ACR) created or identified
- Azure Key Vault (if using secrets)
- Log Analytics workspace

### AWS Access
- AWS CLI configured with read access to:
  - ECR (to pull images)
  - ECS (to read task/service definitions)
  - Secrets Manager (to review secrets structure)

## Phase 1: Container Registry Migration

### Step 1: Authenticate to Registries

```bash
# AWS ECR Login
aws ecr get-login-password --region <aws-region> | \
  docker login --username AWS --password-stdin <aws-account>.dkr.ecr.<aws-region>.amazonaws.com

# Azure ACR Login
az acr login --name <registry-name>
```

### Step 2: Pull Images from ECR

```bash
# Pull from ECR
docker pull <aws-account>.dkr.ecr.<aws-region>.amazonaws.com/<image-name>:<tag>
```

### Step 3: Tag and Push to ACR

```bash
# Tag for ACR
docker tag <aws-account>.dkr.ecr.<aws-region>.amazonaws.com/<image-name>:<tag> \
  <registry-name>.azurecr.io/<image-name>:<tag>

# Push to ACR
docker push <registry-name>.azurecr.io/<image-name>:<tag>
```

### Automation Script: `migrate-images.sh`

```bash
#!/bin/bash
set -e

# Configuration
AWS_ACCOUNT_ID="123456789012"
AWS_REGION="us-east-1"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ACR_NAME="myregistry"
ACR_REGISTRY="${ACR_NAME}.azurecr.io"

# Array of images to migrate
IMAGES=(
  "my-app:v1.0"
  "my-app:v1.1"
  "worker:latest"
)

# ECR Login
echo "Logging into AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# ACR Login
echo "Logging into Azure ACR..."
az acr login --name $ACR_NAME

# Migrate each image
for image in "${IMAGES[@]}"; do
  echo "Migrating $image..."
  
  # Pull from ECR
  docker pull "$ECR_REGISTRY/$image"
  
  # Tag for ACR
  docker tag "$ECR_REGISTRY/$image" "$ACR_REGISTRY/$image"
  
  # Push to ACR
  docker push "$ACR_REGISTRY/$image"
  
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

# Get workspace ID and key
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

### Step 3: Configure Virtual Network (Optional)

**NOTE**: If you need VNet integration, create the VNet and subnet BEFORE Step 2, then use `--infrastructure-subnet-resource-id` when creating the Container Apps environment in Step 2. Alternatively, recreate the environment with VNet support.

```bash
# Create VNet and subnet
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

# If you haven't created the environment yet, include --infrastructure-subnet-resource-id in Step 2
# Otherwise, you'll need to delete and recreate the environment with VNet support:
az containerapp env delete --name myapp-env --resource-group myapp-rg --yes

az containerapp env create \
  --name myapp-env \
  --resource-group myapp-rg \
  --location eastus \
  --logs-workspace-id $LOG_WORKSPACE_ID \
  --logs-workspace-key $LOG_WORKSPACE_KEY \
  --infrastructure-subnet-resource-id $SUBNET_ID
```

## Phase 3: Secrets Configuration

### Step 1: Create Azure Key Vault (if needed)

```bash
az keyvault create \
  --name myapp-kv \
  --resource-group myapp-rg \
  --location eastus
```

### Step 2: Migrate Secrets from AWS Secrets Manager

```bash
# List secrets from AWS (for reference)
aws secretsmanager list-secrets --region us-east-1

# Get secret value from AWS into a secure temporary file
SECRET_FILE=$(mktemp)
aws secretsmanager get-secret-value \
  --secret-id my-secret \
  --region us-east-1 \
  --query SecretString \
  --output text > "$SECRET_FILE"

# Store in Azure Key Vault without putting the secret on the command line
az keyvault secret set \
  --vault-name myapp-kv \
  --name my-secret \
  --file "$SECRET_FILE"

# Securely clean up the temporary file
shred -u "$SECRET_FILE" 2>/dev/null || rm -f "$SECRET_FILE"
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
```

## Phase 4: Container App Deployment

### ECS Task Definition to Container Apps Mapping

#### Original ECS Task Definition (JSON)

```json
{
  "family": "my-app",
  "cpu": "512",
  "memory": "1024",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:v1.0",
      "cpu": 512,
      "memory": 1024,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "ENV", "value": "production" },
        { "name": "PORT", "value": "8080" }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Converted Container Apps YAML

```yaml
# containerapp.yaml
properties:
  managedEnvironmentId: /subscriptions/.../resourceGroups/myapp-rg/providers/Microsoft.App/managedEnvironments/myapp-env
  configuration:
    activeRevisionsMode: single
    ingress:
      external: true
      targetPort: 8080
      transport: auto
      allowInsecure: false
    secrets:
      - name: db-password
        keyVaultUrl: https://myapp-kv.vault.azure.net/secrets/db-password
    registries:
      - server: myregistry.azurecr.io
        identity: /subscriptions/.../resourceGroups/myapp-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/myapp-identity
  template:
    containers:
      - name: app
        image: myregistry.azurecr.io/my-app:v1.0
        resources:
          cpu: 0.5
          memory: 1Gi
        env:
          - name: ENV
            value: production
          - name: PORT
            value: "8080"
          - name: DB_PASSWORD
            secretRef: db-password
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "100"
```

### Deploy Using Azure CLI

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
  --cpu 0.5 \
  --memory 1Gi \
  --min-replicas 1 \
  --max-replicas 10 \
  --user-assigned $IDENTITY_ID \
  --registry-identity $IDENTITY_ID \
  --registry-server myregistry.azurecr.io \
  --secrets db-password=keyvaultref:$SECRET_URI,identityref:$IDENTITY_ID \
  --env-vars \
    ENV=production \
    PORT=8080 \
    DB_PASSWORD=secretref:db-password
```

### Deploy Using Bicep

```bicep
// main.bicep
param location string = resourceGroup().location
param appName string
param environmentId string
param image string
param managedIdentityId string

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
          keyVaultUrl: 'https://myapp-kv.vault.azure.net/secrets/db-password'
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
          name: 'app'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'DB_PASSWORD'
              secretRef: 'db-password'
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

output fqdn string = containerApp.properties.configuration.ingress.fqdn
```

Deploy with:

```bash
az deployment group create \
  --resource-group myapp-rg \
  --template-file main.bicep \
  --parameters \
    appName=my-app \
    environmentId=$ENV_ID \
    image=myregistry.azurecr.io/my-app:v1.0 \
    managedIdentityId=$IDENTITY_ID
```

## Phase 5: Configure Scaling

### HTTP-based Scaling

```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG \
  --min-replicas 1 \
  --max-replicas 20 \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 100
```

### CPU-based Scaling

```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG \
  --scale-rule-name cpu-rule \
  --scale-rule-type cpu \
  --scale-rule-metadata type=Utilization value=70
```

### Memory-based Scaling

```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG \
  --scale-rule-name memory-rule \
  --scale-rule-type memory \
  --scale-rule-metadata type=Utilization value=80
```

## Phase 6: Validation

### Check Deployment Status

```bash
# Get app status
az containerapp show \
  --name $APP_NAME \
  --resource-group $RG \
  --query properties.runningStatus

# Get FQDN
FQDN=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RG \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Application URL: https://$FQDN"
```

### Test Application

```bash
# Health check
curl -I https://$FQDN/health

# Full request
curl https://$FQDN/api/endpoint
```

### View Logs

```bash
# Stream logs
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RG \
  --follow

# Query logs in Log Analytics
az monitor log-analytics query \
  --workspace $LOG_WORKSPACE_ID \
  --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == '$APP_NAME' | order by TimeGenerated desc | limit 50"
```

### Monitor Metrics

```bash
# Get replica count
az containerapp revision show \
  --name $APP_NAME \
  --resource-group $RG \
  --query properties.replicas

# View metrics in portal
az containerapp browse --name $APP_NAME --resource-group $RG
```

## Troubleshooting

### Container Fails to Start

```bash
# Check replica status
az containerapp replica list \
  --name $APP_NAME \
  --resource-group $RG \
  --revision latest

# View container logs
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RG \
  --tail 100
```

### Image Pull Errors

```bash
# Verify ACR credentials
az containerapp show \
  --name $APP_NAME \
  --resource-group $RG \
  --query properties.configuration.registries

# Test managed identity ACR access
az acr login --name myregistry --identity $IDENTITY_ID
```

### Secret Access Issues

```bash
# Verify Key Vault access policy (for vaults using access policies)
az keyvault show \
  --name myapp-kv \
  --query "properties.accessPolicies[?objectId=='$PRINCIPAL_ID']" \
  -o table

# If the vault uses RBAC instead of access policies, verify role assignments
VAULT_ID=$(az keyvault show --name myapp-kv --query id -o tsv)
az role assignment list \
  --assignee $PRINCIPAL_ID \
  --scope $VAULT_ID \
  --query "[].{role:roleDefinitionName, scope:scope}" \
  -o table

# Test secret access (requires correct access policy or RBAC role)
az keyvault secret show \
  --vault-name myapp-kv \
  --name db-password
```

## Post-Deployment Checklist

- [ ] Application responds to HTTP requests
- [ ] Health endpoint returns 200 OK
- [ ] Environment variables are correct
- [ ] Secrets are accessible
- [ ] Database connectivity works
- [ ] Scaling triggers are functioning
- [ ] Logs are flowing to Log Analytics
- [ ] Metrics are visible in Azure Monitor
- [ ] Custom domain configured (if needed)
- [ ] SSL certificate validated
- [ ] Performance meets requirements
- [ ] Load testing completed
