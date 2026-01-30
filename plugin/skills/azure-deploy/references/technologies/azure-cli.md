# Azure CLI Deployment

Deploy using Azure CLI for standalone Bicep/ARM deployments.

## Overview

Use Azure CLI when:
- Not using azure.yaml / AZD
- Deploying standalone Bicep templates
- Custom deployment scenarios
- CI/CD pipelines without AZD

## Prerequisites

| Requirement | Check Command |
|-------------|---------------|
| Azure CLI installed | `az version` |
| Bicep installed | `az bicep version` |
| Authenticated | `az account show` |
| Subscription set | `az account set --subscription <id>` |

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

### What-If Preview

Preview changes without deploying:

```bash
az deployment sub what-if \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

## Deployment with Parameter Overrides

```bash
az deployment sub create \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json \
  --parameters environmentName=prod \
  --parameters location=westus2
```

## Named Deployments

Track deployments by name:

```bash
az deployment sub create \
  --name "deploy-$(date +%Y%m%d-%H%M%S)" \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

## Deployment Output

### Get Outputs

```bash
az deployment sub show \
  --name <deployment-name> \
  --query "properties.outputs"
```

### Store Output in Variable

```bash
API_URL=$(az deployment sub show \
  --name <deployment-name> \
  --query "properties.outputs.apiUrl.value" -o tsv)
```

## Application Deployment

After infrastructure is provisioned, deploy application code:

### Container Apps

```bash
# Build and push image
az acr build --registry <acr-name> --image myapp:latest .

# Update container app
az containerapp update \
  --name <app-name> \
  --resource-group <rg-name> \
  --image <acr-name>.azurecr.io/myapp:latest
```

### App Service

```bash
# Deploy from local folder
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

## Error Handling

| Error | Resolution |
|-------|------------|
| `AuthorizationFailed` | Check permissions, run `az login` |
| `InvalidTemplateDeployment` | Fix Bicep syntax errors |
| `ResourceGroupNotFound` | Create RG or use sub-level deployment |
| `DeploymentFailed` | Check resource-specific errors |

## Cleanup

Delete resource group and all resources:

```bash
az group delete --name rg-myapp-dev --yes --no-wait
```

⚠️ This is destructive and permanent.
