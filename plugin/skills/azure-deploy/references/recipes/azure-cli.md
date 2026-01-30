# Azure CLI Recipe: Deploy

Guide for deploying to Azure using Azure CLI with Bicep templates.

## Overview

This recipe covers deployment using `az deployment` commands for standalone Bicep infrastructure.

## When to Use

- No azure.yaml in project
- Direct Bicep deployment
- Custom deployment pipelines
- More control over deployment process

## Prerequisites

Before deploying:

1. **Preparation Manifest** exists with status `Validated`
2. **Azure CLI** authenticated (`az account show`)
3. **Bicep templates** validated
4. **Correct subscription** selected

## Deployment Commands

### Subscription-Level Deployment

For templates with `targetScope = 'subscription'`:

```bash
az deployment sub create \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json \
  --parameters environmentName=dev
```

### Resource Group Deployment

For templates targeting a resource group:

```bash
az deployment group create \
  --resource-group rg-myapp-dev \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

### Named Deployment

Track deployments by name:

```bash
az deployment sub create \
  --name "deploy-$(date +%Y%m%d-%H%M%S)" \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

### What-If Before Deploy

Preview changes first:

```bash
az deployment sub what-if \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

## Application Deployment

After infrastructure is provisioned, deploy application code:

### Container Apps

```bash
# Build and push image
az acr build --registry <acr-name> --image myapp:latest ./src/api

# Update container app
az containerapp update \
  --name <app-name> \
  --resource-group <rg-name> \
  --image <acr-name>.azurecr.io/myapp:latest
```

### App Service

```bash
# Deploy from ZIP
az webapp deploy \
  --name <app-name> \
  --resource-group <rg-name> \
  --src-path ./dist.zip \
  --type zip
```

### Azure Functions

```bash
func azure functionapp publish <function-app-name>
```

## Get Deployment Outputs

```bash
# Get all outputs
az deployment sub show \
  --name <deployment-name> \
  --query "properties.outputs"

# Get specific output
API_URL=$(az deployment sub show \
  --name <deployment-name> \
  --query "properties.outputs.apiUrl.value" -o tsv)
```

## Error Handling

### Common Errors

| Error | Resolution |
|-------|------------|
| `AuthorizationFailed` | Check permissions, run `az login` |
| `InvalidTemplateDeployment` | Fix Bicep syntax errors |
| `ResourceGroupNotFound` | Create RG or use sub-level deployment |
| `QuotaExceeded` | Request quota increase or change region |

### View Deployment Errors

```bash
az deployment sub show \
  --name <deployment-name> \
  --query "properties.error"
```

## Recording Outcomes

Update Preparation Manifest:

```markdown
## Deployment Status

| Environment | Status | Timestamp | Deployment Name |
|-------------|--------|-----------|-----------------|
| dev | ✅ Deployed | 2026-01-29T14:30:00Z | deploy-20260129-143000 |

### Deployed Resources

| Resource | Type | Name |
|----------|------|------|
| Resource Group | rg | rg-myapp-dev |
| Container App | ca | myapp-api-xxxxx |
| Key Vault | kv | myapp-kv-xxxxx |
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Azure Login
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Deploy Infrastructure
  run: |
    az deployment sub create \
      --location eastus \
      --template-file ./infra/main.bicep \
      --parameters environmentName=${{ vars.ENVIRONMENT }}
```

### Azure DevOps

```yaml
- task: AzureCLI@2
  inputs:
    azureSubscription: 'azure-connection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      az deployment sub create \
        --location eastus \
        --template-file ./infra/main.bicep \
        --parameters environmentName=$(ENVIRONMENT)
```

## Cleanup (DESTRUCTIVE)

Delete resource group and all resources:

```bash
az group delete --name rg-myapp-dev --yes --no-wait
```

⚠️ This is permanent and cannot be undone.
