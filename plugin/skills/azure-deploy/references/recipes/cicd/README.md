# CI/CD Deploy Recipe

Deploy to Azure using automated pipelines.

## Prerequisites

- `.azure/preparation-manifest.md` exists with status `Validated`
- Azure Service Principal or federated credentials configured
- Pipeline file exists (`.github/workflows/` or `azure-pipelines.yml`)

## GitHub Actions

### AZD Workflow

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: dev
    
    steps:
      - uses: actions/checkout@v4

      - name: Install azd
        uses: Azure/setup-azd@v1

      - name: Azure Login
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

### Bicep Workflow

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths: ['infra/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - uses: azure/arm-deploy@v2
        with:
          scope: subscription
          subscriptionId: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          region: eastus
          template: ./infra/main.bicep
          parameters: environmentName=${{ vars.ENVIRONMENT }}
```

## Azure DevOps

### AZD Pipeline

```yaml
trigger:
  branches:
    include: [main]

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: Deploy
    jobs:
      - job: DeployToAzure
        steps:
          - task: setup-azd@0

          - task: AzureCLI@2
            inputs:
              azureSubscription: 'azure-service-connection'
              scriptType: 'bash'
              inlineScript: azd up --no-prompt
            env:
              AZURE_ENV_NAME: $(AZURE_ENV_NAME)
              AZURE_LOCATION: $(AZURE_LOCATION)
```

### Multi-Stage with Approvals

```yaml
stages:
  - stage: Dev
    jobs:
      - deployment: DeployDev
        environment: dev
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: 'azure-dev'
                    scriptType: 'bash'
                    inlineScript: azd up --no-prompt --environment dev

  - stage: Prod
    dependsOn: Dev
    jobs:
      - deployment: DeployProd
        environment: prod  # Configure approval in Azure DevOps
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: 'azure-prod'
                    scriptType: 'bash'
                    inlineScript: azd up --no-prompt --environment prod
```

## Setup Requirements

### GitHub Actions

1. Create Azure Service Principal with federated credentials
2. Add secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
3. Add variables: `AZURE_ENV_NAME`, `AZURE_LOCATION`
4. Create environments with protection rules

### Azure DevOps

1. Create Service Connection to Azure
2. Create Variable Groups per environment
3. Create Environments with approval gates

## References

- [Verification steps](mdc:verify.md)
- [Error handling](mdc:errors.md)
| Pipeline timeout | Increase timeout or optimize deployment |
| Approval pending | Request approval in environment settings |
