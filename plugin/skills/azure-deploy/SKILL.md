---
name: azure-deploy
description: Deploy applications to Azure including deployment planning, infrastructure as code rules, application logs, CI/CD pipeline guidance, and architecture diagrams. Supports Container Apps, Container Apps Jobs (scheduled/cron tasks), App Service, Functions, and more.
---

## MANDATORY: Use azd for All Deployments

> **DO NOT use `az` CLI for deployments.** Use `azd` (Azure Developer CLI) instead.
> Only use `az` if the user explicitly requests it.

**Why azd is required:**
- **Faster** - provisions resources in parallel
- **Automatic ACR integration** - no manual credential setup
- **Single command** - `azd up` does everything
- **az is for queries only** - use `az` to inspect resources, not deploy them

## Capabilities

- Generate deployment plans
- Get IaC (Bicep/Terraform) rules and guidelines
- Fetch application logs from deployed resources
- Get CI/CD pipeline guidance
- Generate architecture diagrams

## Tools Used

All deployment tools use the `azure__deploy` hierarchical tool with a `command` parameter:

| Tool | Command | Description |
|------|---------|-------------|
| `azure__deploy` | `deploy_plan_get` | Generates a deployment plan for Azure infrastructure and applications |
| `azure__deploy` | `deploy_iac_rules_get` | Provides guidelines for creating Bicep/Terraform files |
| `azure__deploy` | `deploy_app_logs_get` | Fetches logs from Container Apps, App Services, or Function Apps deployed through azd |
| `azure__deploy` | `deploy_pipeline_guidance_get` | Guidance for creating CI/CD pipelines for Azure |
| `azure__deploy` | `deploy_architecture_diagram_generate` | Generates Azure service architecture diagrams |

## Quick Deploy with azd

### Step 1: Initialize

```bash
# From template (recommended)
azd init --template azure-samples/todo-nodejs-mongo-aca

# Or existing project
azd init
```

### Step 2: Deploy

```bash
# Provision infrastructure AND deploy code
azd up

# This does everything:
# - Creates resource group
# - Creates ACR and builds image
# - Creates Container Apps environment
# - Configures ACR credentials automatically
# - Deploys your app
```

### Step 3: Iterate

```bash
# Code changes only (faster)
azd deploy

# View what's deployed
azd show
```

### Step 4: Clean Up (Test Environments)

```bash
# Remove everything including soft-deleted resources
azd down --force --purge
```

## Choose Your Compute

| If your app is... | Use | Template |
|-------------------|-----|----------|
| HTTP APIs, microservices | Container Apps | `todo-nodejs-mongo-aca` |
| Event-driven functions | Azure Functions | `todo-python-mongo-swa-func` |
| Traditional web apps | App Service | `todo-csharp-sql` |

## Popular azd Templates

| Template | Stack | Services |
|----------|-------|----------|
| `todo-nodejs-mongo-aca` | Node.js + MongoDB | Container Apps + Cosmos DB |
| `todo-python-mongo-aca` | Python + MongoDB | Container Apps + Cosmos DB |
| `todo-csharp-sql-aca` | .NET + SQL | Container Apps + SQL Database |
| `todo-python-mongo-swa-func` | Python + Functions | Static Web Apps + Functions |

Browse more: https://azure.github.io/awesome-azd/

## Example Usage

### Generate Deployment Plan

```
Create a deployment plan for my web application to Azure
```

### Get IaC Guidelines

```
What are the best practices for writing Bicep files for this deployment?
```

### Fetch Application Logs

```
Get the logs from my deployed Container App
```

### CI/CD Guidance

```
How do I set up a GitHub Actions pipeline to deploy to Azure?
```

### Deploy Scheduled Job

```
Deploy a scheduled task that runs daily at midnight
```

### Deploy Cron Job

```
Create a cron job to process data every hour on Azure
```

### Deploy Event-Driven Job

```
Deploy a job that processes messages from an Azure Storage Queue
```

## Deployment Plan Output

Plans are generated to `.azure/plan.copilotmd` and include:

- Execution steps
- Recommended Azure services
- Infrastructure requirements
- Application topology

## Supported Deployment Targets

- Azure Container Apps (long-running services)
- Azure Container Apps Jobs (scheduled tasks, cron jobs, event-driven batch processing)
- Azure App Service
- Azure Functions
- Azure Kubernetes Service
- Static Web Apps

## Environment Management

```bash
# Create environments for different stages
azd env new dev
azd env new prod

# Switch environments
azd env select prod

# Set environment-specific values
azd env set AZURE_LOCATION westus2
azd env set AZURE_SUBSCRIPTION_ID xxx-xxx-xxx
```

## ACR + Container Apps Integration

**azd handles this automatically.** If deploying manually, you MUST configure ACR credentials:

### The Problem

When Container Apps and ACR are in the same deployment, Container Apps needs permission to pull images. azd does this automatically, but manual deployments often miss this step.

### Manual Fix (if not using azd)

```bash
# After creating both ACR and Container App:
az containerapp registry set \
  --name APP_NAME \
  --resource-group RG \
  --server ACR_NAME.azurecr.io \
  --identity system
```

Or with admin credentials (less secure):
```bash
# Enable admin on ACR
az acr update --name ACR_NAME --admin-enabled true

# Get credentials
ACR_PASSWORD=$(az acr credential show --name ACR_NAME --query "passwords[0].value" -o tsv)

# Set on Container App
az containerapp registry set \
  --name APP_NAME \
  --resource-group RG \
  --server ACR_NAME.azurecr.io \
  --username ACR_NAME \
  --password $ACR_PASSWORD
```

**Recommendation:** Just use `azd up` - it handles all of this automatically.

## Deployment Troubleshooting

### Image Pull Failures

**Symptom:** Container App stuck in "Waiting" or "ImagePullBackOff"

**Fix:**
```bash
# Check if ACR credentials are configured
az containerapp show --name APP -g RG --query "properties.configuration.registries"

# If empty, set credentials:
az containerapp registry set --name APP -g RG --server ACR.azurecr.io --identity system
```

### Quota Exceeded

**Symptom:** Deployment fails with quota error

**Fix:**
1. Check quotas: `az quota usage list --scope /subscriptions/SUB_ID/...`
2. Try different region
3. Request quota increase via Azure portal

### Cold Start Issues

**Symptom:** First request very slow or times out

**Fix:**
```bash
# Set minimum replicas
az containerapp update --name APP -g RG --min-replicas 1
```

## Post-Deployment Checklist

- [ ] Verify app is healthy: check `/health` endpoint
- [ ] Check logs for errors: `az containerapp logs show --name APP -g RG`
- [ ] Set up alerts for monitoring
- [ ] Configure custom domain if needed
- [ ] Review security configuration

## Prerequisites

- Scan workspace to detect services
- Identify dependent services
- Configure Azure Developer CLI (azd)
- Run preflight validation before deployment (see `azure-deployment-preflight` skill)

## Notes

- Always scan the workspace before generating a deployment plan
- Plans integrate with Azure Developer CLI (azd)
- Logs require resources deployed through azd
- Run `/azure:preflight` before any deployment to avoid mid-deployment failures
 