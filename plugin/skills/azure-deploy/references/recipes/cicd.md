# CI/CD Recipe: Deploy

Guide for deploying to Azure using CI/CD pipelines.

## Overview

This recipe covers deployment automation using GitHub Actions and Azure DevOps pipelines.

## When to Use

- Automated deployments on push/merge
- Multi-environment promotion (dev → staging → prod)
- Team collaboration with approvals
- Consistent, repeatable deployments

## GitHub Actions

### AZD Deployment Workflow

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

      - name: Log in with Azure (Federated Credentials)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy with azd
        run: azd up --no-prompt
        env:
          AZURE_ENV_NAME: ${{ vars.AZURE_ENV_NAME }}
          AZURE_LOCATION: ${{ vars.AZURE_LOCATION }}
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### Bicep Deployment Workflow

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'infra/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy Bicep
        uses: azure/arm-deploy@v2
        with:
          scope: subscription
          subscriptionId: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          region: eastus
          template: ./infra/main.bicep
          parameters: environmentName=${{ vars.ENVIRONMENT }}
```

### Multi-Environment Workflow

```yaml
name: Deploy to Environments

on:
  push:
    branches: [main]

jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/setup-azd@v1
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: azd up --no-prompt --environment dev

  deploy-staging:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/setup-azd@v1
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: azd up --no-prompt --environment staging

  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: 
      name: prod
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/setup-azd@v1
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - id: deploy
        run: azd up --no-prompt --environment prod
```

## Azure DevOps

### AZD Pipeline

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: Deploy
    jobs:
      - job: DeployToAzure
        steps:
          - task: setup-azd@0
            displayName: Install azd

          - task: AzureCLI@2
            displayName: Deploy with azd
            inputs:
              azureSubscription: 'azure-service-connection'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                azd up --no-prompt
            env:
              AZURE_ENV_NAME: $(AZURE_ENV_NAME)
              AZURE_LOCATION: $(AZURE_LOCATION)
              AZURE_SUBSCRIPTION_ID: $(AZURE_SUBSCRIPTION_ID)
```

### Bicep Pipeline

```yaml
trigger:
  branches:
    include:
      - main
  paths:
    include:
      - infra/*

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: Deploy
    jobs:
      - job: DeployInfrastructure
        steps:
          - task: AzureCLI@2
            displayName: Deploy Bicep
            inputs:
              azureSubscription: 'azure-service-connection'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                az deployment sub create \
                  --location eastus \
                  --template-file ./infra/main.bicep \
                  --parameters environmentName=$(ENVIRONMENT)
```

### Multi-Stage Pipeline with Approvals

```yaml
trigger:
  branches:
    include:
      - main

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

  - stage: Staging
    dependsOn: Dev
    jobs:
      - deployment: DeployStaging
        environment: staging
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: 'azure-staging'
                    scriptType: 'bash'
                    inlineScript: azd up --no-prompt --environment staging

  - stage: Prod
    dependsOn: Staging
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

1. **Create Azure Service Principal** with federated credentials
2. **Add secrets** to repository:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
3. **Add variables**:
   - `AZURE_ENV_NAME`
   - `AZURE_LOCATION`
4. **Create environments** (dev, staging, prod) with protection rules

### Azure DevOps

1. **Create Service Connection** to Azure
2. **Create Variable Groups** for each environment
3. **Create Environments** with approval gates
4. **Configure Pipeline** with appropriate triggers

## Recording Outcomes

Update Preparation Manifest:

```markdown
## Deployment Status

| Environment | Status | Pipeline Run | Triggered By |
|-------------|--------|--------------|--------------|
| dev | ✅ Deployed | #123 | push to main |
| staging | ✅ Deployed | #123 | auto after dev |
| prod | ✅ Deployed | #123 | manual approval |

### Pipeline Configuration

| Platform | Pipeline | URL |
|----------|----------|-----|
| GitHub Actions | deploy.yml | https://github.com/org/repo/actions |
```
