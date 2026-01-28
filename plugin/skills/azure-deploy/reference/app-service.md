# Azure App Service Deployment Guide

Complete reference for deploying and managing traditional web applications using Azure App Service for managed platform hosting.

---

## Overview

Azure App Service is a fully managed platform-as-a-service (PaaS) for hosting web applications, REST APIs, and mobile backends. It provides automatic scaling, load balancing, and integrated deployment tools.

**Key Benefits:**
- **Fully managed** - No infrastructure management required
- **Multiple languages** - Node.js, Python, .NET, Java, PHP, Ruby
- **Built-in CI/CD** - GitHub Actions, Azure DevOps integration
- **Auto-scaling** - Scale based on metrics or schedule
- **Deployment slots** - Zero-downtime deployments
- **Custom domains** - HTTPS with managed certificates

**When to use App Service:**
- Traditional web applications (MVC, SPA with server-side)
- REST APIs that don't require containers
- Mobile backends
- WordPress, Drupal, and other CMS platforms
- Applications requiring VNet integration
- Applications needing always-on availability

**For containerized apps, consider Container Apps. For serverless, consider Azure Functions.**

---

## Always Use azd for Deployments

> **Always use `azd` (Azure Developer CLI) for Azure provisioning and App Service deployments.**
> The `azd` tool provides a complete, reproducible deployment workflow for all App Service scenarios.

```bash
# Deploy everything - THIS IS THE REQUIRED APPROACH
azd up --no-prompt

# Or step-by-step:
azd provision --no-prompt   # Create App Service, plan, and dependencies
azd deploy --no-prompt      # Deploy application code

# Preview changes before deployment
azd provision --preview

# Clean up test environments
azd down --force --purge
```

> ⚠️ **CRITICAL: `azd down` Data Loss Warning**
>
> `azd down` **permanently deletes ALL resources** including databases with data, storage accounts, and Key Vaults.
> - `--force` skips confirmation
> - `--purge` permanently deletes Key Vault (no soft-delete recovery)
>
> Always back up important data before running `azd down`.

**Why azd is required:**
- **Parallel provisioning** - Deploys in seconds, not minutes
- **Single command** - `azd up` replaces 5+ commands
- **Infrastructure as Code** - Reproducible with Bicep
- **Environment management** - Easy dev/staging/prod separation
- **Consistent workflow** - Same commands work across all Azure services

---

## Quick Reference

| Property | Value |
|----------|-------|
| Deployment tool | `azd` (Azure Developer CLI) |
| MCP tools | `azure-azd` (commands: `validate_azure_yaml`, `discovery_analysis`) |
| Best for | Web apps, REST APIs, managed hosting |
| azd Template | `todo-csharp-sql`, `todo-nodejs-mongo` |

---

## Prerequisites

### Required Tools

**Azure Developer CLI (azd):**
```bash
# macOS
brew tap azure/azure-dev && brew install azd

# Windows
winget install Microsoft.Azd

# Linux
curl -fsSL https://aka.ms/install-azd.sh | bash
```

### Authentication

```bash
# Login to Azure with azd
azd auth login

# Verify login status
azd auth login --check-status

# Set environment and subscription
azd env new <environment-name>
azd env set AZURE_SUBSCRIPTION_ID "<subscription-id>"
```

---

## Pre-flight Check

**Run `/azure:preflight` before deploying** to verify:
- Tools installed (azd)
- Authentication valid
- Quotas sufficient
- Subscription has capacity

---

## Quick Deploy with azd

### MCP Tools for App Service

Use the Azure MCP server's azd tools (`azure-azd`) for validation:

| Command | Description |
|---------|-------------|
| `validate_azure_yaml` | Validate azure.yaml before deployment |
| `project_validation` | Comprehensive validation before deployment |
| `error_troubleshooting` | Diagnose azd errors |

**Validate before deployment:**
```javascript
const validation = await azure-azd({
  command: "validate_azure_yaml",
  parameters: { path: "./azure.yaml" }
});
```

### Using AZD Template

```bash
# 1. Initialize from template
azd init --template azure-samples/todo-csharp-sql

# 2. Deploy (provisions + deploys in parallel)
# Use --no-prompt for automation/agent scenarios
azd up --no-prompt

# 3. Iterate on code changes
azd deploy --no-prompt

# 4. View application logs
azd monitor --logs

# 5. Clean up test environment (WARNING: deletes all resources)
azd down --force --purge
```

### Custom Bicep for App Service

Create `infra/main.bicep`:
```bicep
param location string = resourceGroup().location
param appName string = 'webapp-${uniqueString(resourceGroup().id)}'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true  // Linux
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
      ]
    }
  }
}

output webAppUrl string = webApp.properties.defaultHostName
```

---

## App Service Plans

### Plan Tiers

| Tier | Features | Use Case | Pricing |
|------|----------|----------|---------|
| **Free (F1)** | Shared compute, 60 min/day | Development, testing | Free |
| **Shared (D1)** | Shared compute, 240 min/day | Small personal projects | ~$10/month |
| **Basic (B1-B3)** | Dedicated VMs, no auto-scale | Small production apps | ~$13-52/month |
| **Standard (S1-S3)** | Auto-scale, staging slots, backups | Production apps | ~$70-280/month |
| **Premium (P1v3-P3v3)** | Enhanced performance, VNet | High-scale production | ~$100-400/month |
| **Isolated (I1v2-I3v2)** | Dedicated environment, ASE | Compliance, security | ~$400-1600/month |

### Creating App Service Plans

> **Note:** Always use `azd up --no-prompt` for deployments. Define plan configuration in Bicep templates. The commands below are legacy reference only.

```bash
# Create Basic plan
az appservice plan create \
    --name myplan \
    --resource-group RG \
    --location eastus \
    --sku B1 \
    --is-linux

# Create Standard plan with auto-scale
az appservice plan create \
    --name myplan \
    --resource-group RG \
    --location eastus \
    --sku S1 \
    --is-linux

# Create Premium plan
az appservice plan create \
    --name myplan \
    --resource-group RG \
    --location eastus \
    --sku P1v3 \
    --is-linux
```

---

## Creating Web Apps

### Supported Runtimes

**Linux runtimes:**
- Node.js: `"NODE:18-lts"`, `"NODE:20-lts"`
- Python: `"PYTHON:3.9"`, `"PYTHON:3.10"`, `"PYTHON:3.11"`, `"PYTHON:3.12"`
- .NET: `"DOTNETCORE:6.0"`, `"DOTNETCORE:7.0"`, `"DOTNETCORE:8.0"`
- Java: `"JAVA:17-java17"`, `"JAVA:21-java21"`
- PHP: `"PHP:8.1"`, `"PHP:8.2"`

**Windows runtimes:**
- .NET Framework: `"v4.8"`, `"v3.5"`
- ASP.NET Core: `"ASPNET:V4.8"`, `"ASPNET:V6.0"`
- Node.js: Configured via app settings

### Create Web App

> **Note:** Always use `azd up --no-prompt` for deployments. The commands below are legacy reference only.

```bash
# Create Node.js web app
az webapp create \
    --name myapp \
    --resource-group RG \
    --plan myplan \
    --runtime "NODE:20-lts"

# Create Python web app
az webapp create \
    --name myapp \
    --resource-group RG \
    --plan myplan \
    --runtime "PYTHON:3.12"

# Create .NET web app
az webapp create \
    --name myapp \
    --resource-group RG \
    --plan myplan \
    --runtime "DOTNETCORE:8.0"

# Create Java web app
az webapp create \
    --name myapp \
    --resource-group RG \
    --plan myplan \
    --runtime "JAVA:17-java17"
```

---

## Deployment Methods

### Method 1: ZIP Deploy (Recommended for CLI)

```bash
# Package application
zip -r app.zip . -x "*.git*" "node_modules/*" ".env"

# Deploy
az webapp deploy \
    --name myapp \
    --resource-group RG \
    --src-path app.zip \
    --type zip

# For async deployment (doesn't wait)
az webapp deploy \
    --name myapp \
    --resource-group RG \
    --src-path app.zip \
    --type zip \
    --async true
```

### Method 2: Git Deploy

```bash
# Configure local git deployment
az webapp deployment source config-local-git \
    --name myapp \
    --resource-group RG

# Get git URL
GIT_URL=$(az webapp deployment list-publishing-credentials \
    --name myapp \
    --resource-group RG \
    --query scmUri -o tsv)

# Add remote and push
git remote add azure $GIT_URL
git push azure main
```

### Method 3: GitHub Actions

```bash
# Configure GitHub deployment
az webapp deployment github-actions add \
    --name myapp \
    --resource-group RG \
    --repo owner/repo \
    --branch main \
    --runtime node \
    --runtime-version 20

# Or manually create workflow
```

**GitHub Actions workflow:**
```yaml
name: Deploy to Azure Web App

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AZURE_WEBAPP_NAME: myapp
  NODE_VERSION: '20.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: npm install and build
        run: |
          npm ci
          npm run build --if-present
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ env.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

### Method 4: Docker Container

```bash
# Create web app for containers
az webapp create \
    --name myapp \
    --resource-group RG \
    --plan myplan \
    --deployment-container-image-name myregistry.azurecr.io/myapp:latest

# Configure continuous deployment
az webapp deployment container config \
    --name myapp \
    --resource-group RG \
    --enable-cd true
```

---

## Deployment Slots

Deployment slots enable zero-downtime deployments with staging environments.

```bash
# Create staging slot
az webapp deployment slot create \
    --name myapp \
    --resource-group RG \
    --slot staging

# Deploy to staging
az webapp deploy \
    --name myapp \
    --resource-group RG \
    --slot staging \
    --src-path app.zip \
    --type zip

# Test staging: https://myapp-staging.azurewebsites.net

# Swap slots (zero downtime)
az webapp deployment slot swap \
    --name myapp \
    --resource-group RG \
    --slot staging \
    --target-slot production

# Swap with preview (two-phase swap)
az webapp deployment slot swap \
    --name myapp \
    --resource-group RG \
    --slot staging \
    --action preview

# Complete the swap
az webapp deployment slot swap \
    --name myapp \
    --resource-group RG \
    --slot staging \
    --action swap

# Cancel swap
az webapp deployment slot swap \
    --name myapp \
    --resource-group RG \
    --slot staging \
    --action reset
```

---

## Configuration

### Application Settings

```bash
# Set application settings (environment variables)
az webapp config appsettings set \
    --name myapp \
    --resource-group RG \
    --settings \
        NODE_ENV=production \
        API_KEY=@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/apikey/)

# List settings
az webapp config appsettings list \
    --name myapp \
    --resource-group RG

# Delete setting
az webapp config appsettings delete \
    --name myapp \
    --resource-group RG \
    --setting-names NODE_ENV
```

### Connection Strings

```bash
# Set connection string
az webapp config connection-string set \
    --name myapp \
    --resource-group RG \
    --connection-string-type SQLAzure \
    --settings MyDb="Server=tcp:..."

# List connection strings
az webapp config connection-string list \
    --name myapp \
    --resource-group RG
```

### General Configuration

```bash
# Enable always on (prevents cold starts)
az webapp config set \
    --name myapp \
    --resource-group RG \
    --always-on true

# Set minimum TLS version
az webapp config set \
    --name myapp \
    --resource-group RG \
    --min-tls-version 1.2

# Configure HTTP/2
az webapp config set \
    --name myapp \
    --resource-group RG \
    --http20-enabled true

# Set startup command (for custom entry points)
az webapp config set \
    --name myapp \
    --resource-group RG \
    --startup-file "npm start"
```

---

## Scaling

### Scale Up (Vertical Scaling)

Change to a higher-tier plan with more resources:

```bash
# Scale up to Standard S1
az appservice plan update \
    --name myplan \
    --resource-group RG \
    --sku S1

# Scale up to Premium P1v3
az appservice plan update \
    --name myplan \
    --resource-group RG \
    --sku P1v3
```

### Scale Out (Horizontal Scaling)

Add more instances:

```bash
# Manual scale out
az appservice plan update \
    --name myplan \
    --resource-group RG \
    --number-of-workers 3

# Enable auto-scale (requires Standard or higher)
az monitor autoscale create \
    --name myautoscale \
    --resource-group RG \
    --resource /subscriptions/{sub}/resourceGroups/RG/providers/Microsoft.Web/serverfarms/myplan \
    --min-count 1 \
    --max-count 10 \
    --count 2

# Add scale rule based on CPU
az monitor autoscale rule create \
    --resource-group RG \
    --autoscale-name myautoscale \
    --condition "Percentage CPU > 70 avg 5m" \
    --scale out 1

az monitor autoscale rule create \
    --resource-group RG \
    --autoscale-name myautoscale \
    --condition "Percentage CPU < 25 avg 5m" \
    --scale in 1
```

---

## Custom Domains and SSL

### Add Custom Domain

```bash
# Map custom domain
az webapp config hostname add \
    --webapp-name myapp \
    --resource-group RG \
    --hostname www.contoso.com

# Bind SSL certificate
az webapp config ssl bind \
    --name myapp \
    --resource-group RG \
    --certificate-thumbprint {thumbprint} \
    --ssl-type SNI
```

### Managed Certificate (Free)

```bash
# Create managed certificate
az webapp config ssl create \
    --name myapp \
    --resource-group RG \
    --hostname www.contoso.com

# Bind managed certificate
az webapp config ssl bind \
    --name myapp \
    --resource-group RG \
    --certificate-thumbprint {thumbprint} \
    --ssl-type SNI
```

---

## Monitoring and Logging

### Application Logging

```bash
# Enable application logging
az webapp log config \
    --name myapp \
    --resource-group RG \
    --application-logging azureblobstorage

# Stream logs
az webapp log tail \
    --name myapp \
    --resource-group RG

# Download logs
az webapp log download \
    --name myapp \
    --resource-group RG \
    --log-file logs.zip
```

### Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
    --app myapp-insights \
    --location eastus \
    --resource-group RG \
    --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
    --app myapp-insights \
    --resource-group RG \
    --query instrumentationKey -o tsv)

# Get connection string (preferred)
CONNECTION_STRING=$(az monitor app-insights component show \
    --app myapp-insights \
    --resource-group RG \
    --query connectionString -o tsv)

# Configure in web app
az webapp config appsettings set \
    --name myapp \
    --resource-group RG \
    --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$CONNECTION_STRING"
```

---

## MCP Tools (For Queries Only)

Use MCP tools to **query** existing App Service resources, not deploy:

| Command | Description | Parameters |
|---------|-------------|------------|
| `appservice_webapp_list` | List web apps in subscription/resource group | `subscription`, `resource-group` (optional) |
| `appservice_webapp_get` | Get web app details | `name`, `resource-group` |
| `appservice_plan_list` | List App Service plans | `subscription`, `resource-group` (optional) |

**Example usage:**
```javascript
// List all web apps
const webApps = await azure__appservice({
  intent: "List web apps",
  command: "appservice_webapp_list",
  parameters: {
    subscription: "my-subscription-id"
  }
});

// Get web app details
const appDetails = await azure__appservice({
  intent: "Get web app details",
  command: "appservice_webapp_get",
  parameters: {
    name: "myapp",
    "resource-group": "myResourceGroup"
  }
});

// List App Service plans
const plans = await azure__appservice({
  intent: "List App Service plans",
  command: "appservice_plan_list",
  parameters: {
    subscription: "my-subscription-id",
    "resource-group": "myResourceGroup"
  }
});
```

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Use deployment slots** | Zero-downtime deployments with staging-to-production swaps |
| **Store secrets in Key Vault** | Use managed identity to access Key Vault references in app settings |
| **Enable always on** | Prevents cold starts for production apps (Standard tier+) |
| **Configure health checks** | App Service can restart unhealthy instances automatically |
| **Use staging slots** | Test changes in production-like environment before swapping |
| **Enable Application Insights** | Monitor performance, exceptions, and user behavior |
| **Set minimum TLS version** | Use TLS 1.2 or higher for security |
| **Use managed certificates** | Free SSL/TLS certificates for custom domains |
| **Configure auto-scale** | Scale based on metrics for cost optimization |
| **Enable diagnostic logs** | Stream logs to Log Analytics or Storage |

---

## Common Issues

### 503 Service Unavailable

**Symptoms:** App returns 503 error

**Solutions:**
- Check app logs: `az webapp log tail --name myapp -g RG`
- Verify app is starting correctly
- Check memory/CPU usage in metrics
- Ensure dependencies are installed
- Verify connection strings are correct

### Slow Cold Starts

**Symptoms:** First request after idle takes 5-10 seconds

**Solutions:**
- Enable "Always On" (Standard tier+)
- Use Premium tier with pre-warmed instances
- Optimize application startup time
- Consider using deployment slots for pre-warming

### Application Won't Start

**Symptoms:** App shows "Application Error" page

**Solutions:**
- Check application logs
- Verify runtime version matches app requirements
- Check startup command is correct
- Ensure all required app settings are configured
- Verify dependencies are included in deployment

### Connection String Issues

**Symptoms:** Database connection errors

**Solutions:**
- Verify connection string format
- Check firewall rules allow App Service IPs
- Use managed identity for Azure SQL
- Test connection string locally first

---

## Troubleshooting Commands

```bash
# View app details
az webapp show --name myapp -g RG

# Check app state
az webapp show --name myapp -g RG --query "state"

# View configuration
az webapp config show --name myapp -g RG

# View app settings
az webapp config appsettings list --name myapp -g RG

# Stream logs
az webapp log tail --name myapp -g RG

# Download logs
az webapp log download --name myapp -g RG --log-file app-logs.zip

# Restart app
az webapp restart --name myapp -g RG

# Stop app
az webapp stop --name myapp -g RG

# Start app
az webapp start --name myapp -g RG

# View deployment history
az webapp deployment list --name myapp -g RG
```

---

## Additional Resources

- [App Service Documentation](https://learn.microsoft.com/azure/app-service/)
- [App Service Best Practices](https://learn.microsoft.com/azure/app-service/app-service-best-practices)
- [Deployment Best Practices](https://learn.microsoft.com/azure/app-service/deploy-best-practices)
- [Monitoring App Service](https://learn.microsoft.com/azure/app-service/web-sites-monitor)
