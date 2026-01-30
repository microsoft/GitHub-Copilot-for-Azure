# Azure Developer CLI (azd) Deployment

Deploy using Azure Developer CLI—the default and recommended approach.

## Overview

AZD is the primary deployment technology for projects with `azure.yaml`.

## Prerequisites

| Requirement | Check Command |
|-------------|---------------|
| AZD installed | `azd version` |
| Authenticated | `azd auth login --check-status` |
| Environment set | `azd env list` |
| azure.yaml exists | File in project root |

## Deployment Commands

### Full Deployment

Provisions infrastructure and deploys application:

```bash
azd up --no-prompt
```

Equivalent to:
```bash
azd provision --no-prompt
azd deploy --no-prompt
```

### Infrastructure Only

Create or update Azure resources without deploying code:

```bash
azd provision --no-prompt
```

### Application Only

Deploy code to existing infrastructure:

```bash
azd deploy --no-prompt
```

### Preview Changes

See what would be deployed without making changes:

```bash
azd provision --preview --no-prompt
```

## Environment Management

### Create New Environment

```bash
azd env new dev
azd env new staging
azd env new prod
```

### Switch Environment

```bash
azd env select dev
```

### Set Environment Variables

```bash
azd env set AZURE_LOCATION eastus
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
```

### View Environment

```bash
azd env get-values
```

## Deploy to Specific Environment

```bash
azd up --environment prod --no-prompt
```

## Service-Specific Deployment

Deploy only specific services:

```bash
azd deploy api --no-prompt
azd deploy web --no-prompt
```

## Deployment Output

Successful deployment shows:

```
Deploying services (azd deploy)

  (✓) Done: Deploying service api
  - Endpoint: https://api-xxxx.azurecontainerapps.io

  (✓) Done: Deploying service web
  - Endpoint: https://web-xxxx.azurestaticapps.net

SUCCESS: Your application was deployed to Azure
```

## Post-Deployment

### View Deployed Resources

```bash
azd show
```

### Open Azure Portal

```bash
azd monitor --overview
```

### View Logs

```bash
azd monitor --logs
```

### View Live Metrics

```bash
azd monitor --live
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install azd
  uses: Azure/setup-azd@v1

- name: Log in with Azure
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Deploy
  run: azd up --no-prompt
  env:
    AZURE_ENV_NAME: ${{ vars.AZURE_ENV_NAME }}
    AZURE_LOCATION: ${{ vars.AZURE_LOCATION }}
    AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### Azure DevOps

```yaml
- task: setup-azd@0

- task: AzureCLI@2
  inputs:
    azureSubscription: 'azure-connection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      azd up --no-prompt
```

## Error Handling

| Error | Resolution |
|-------|------------|
| `Not authenticated` | `azd auth login` |
| `No environment selected` | `azd env select <name>` |
| `azure.yaml not found` | Run azure-prepare skill |
| `Provision failed` | Check Bicep errors, permissions |
| `Deploy failed` | Check build errors, Docker |

## Cleanup

**⚠️ DESTRUCTIVE - Deletes all resources**

```bash
azd down --force --purge
```

Options:
- `--force`: Skip confirmation
- `--purge`: Permanently delete Key Vaults
