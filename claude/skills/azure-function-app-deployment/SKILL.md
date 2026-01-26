---
name: azure-function-app-deployment
description: Deploy serverless functions to Azure Function Apps using Azure CLI and Azure Functions Core Tools. Use this skill when deploying serverless APIs, event-driven functions, timer-triggered jobs, or webhook handlers to Azure Functions.
---

# Azure Function App Deployment

Automated deployment workflow for serverless applications to Azure Function Apps using Azure CLI and Azure Functions Core Tools.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Deploy my function to Azure"
- "Create a serverless API on Azure"
- "Deploy Azure Functions"
- "Set up a timer-triggered function in Azure"
- "Create webhooks in Azure"
- Any request involving **serverless functions**, **event-driven processing**, or **Azure Functions**

**Key Indicators:**
- Project uses Azure Functions (`host.json`, `local.settings.json` present)
- User mentions serverless, functions, triggers, or bindings
- User wants to deploy lightweight APIs without container management
- User needs timer jobs, queue processors, or event handlers

## Overview

This skill enables end-to-end deployment of serverless functions to Azure Function Apps. Azure Functions is a serverless compute service ideal for:
- **RESTful APIs** with HTTP triggers
- **Event-driven processing** responding to queues, blobs, or Event Grid
- **Timer-based jobs** for scheduled tasks
- **Webhook handlers** for integrations

```
Init → Develop → Test Locally → Create Resources → Deploy → Monitor
```

## When to Use

• **Serverless APIs**: Deploy HTTP-triggered functions for REST endpoints
• **Background processing**: Queue-triggered functions for async workloads
• **Scheduled tasks**: Timer-triggered functions for cron-like jobs
• **Event handlers**: Blob, Event Grid, or Service Bus triggered functions
• **Webhooks**: HTTP endpoints for third-party integrations

## Pattern 0: Prerequisites Validation

Validate all prerequisites before starting deployment.

```javascript
async function validatePrerequisites() {
  const checks = [];
  
  // Check Azure CLI authentication
  try {
    await exec('az account show');
    checks.push({ name: 'Azure CLI', status: 'authenticated' });
  } catch (error) {
    throw new Error('Not authenticated with Azure CLI. Run: az login');
  }
  
  // Check Azure Functions Core Tools
  try {
    await exec('func --version');
    checks.push({ name: 'Azure Functions Core Tools', status: 'installed' });
  } catch (error) {
    throw new Error('Azure Functions Core Tools not installed. Install from: https://docs.microsoft.com/azure/azure-functions/functions-run-local');
  }
  
  return checks;
}
```

**Key insight**: Azure Functions Core Tools (`func`) is required for local development and deployment. Install with `npm install -g azure-functions-core-tools@4`.

## Pattern 1: Initialize Function Project

Create a new Azure Functions project with the desired runtime.

```bash
# Create new function project
func init MyFunctionApp --worker-runtime node --model V4

# Create a new HTTP-triggered function
cd MyFunctionApp
func new --name HttpTrigger --template "HTTP trigger"

# For TypeScript
func init MyFunctionApp --worker-runtime node --language typescript --model V4
```

**Supported runtimes:** `node`, `python`, `dotnet`, `dotnet-isolated`, `java`, `powershell`, `custom`

### Project Structure

```
MyFunctionApp/
├── host.json              # Function app configuration
├── local.settings.json    # Local development settings
├── package.json           # Node.js dependencies
└── src/
    └── functions/
        └── HttpTrigger.js # Function code
```

## Pattern 2: Local Development

Test functions locally before deploying.

```bash
# Start local development server
func start

# Start with specific port
func start --port 7072

# Start with debugging enabled
func start --verbose
```

**Local endpoints:**
- HTTP triggers: `http://localhost:7071/api/{functionName}`
- Admin API: `http://localhost:7071/admin/functions`

### Example HTTP Function (Node.js v4)

```javascript
const { app } = require('@azure/functions');

app.http('HttpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('HTTP function processed a request.');
        const name = request.query.get('name') || await request.text() || 'World';
        return { body: `Hello, ${name}!` };
    }
});
```

### Example Timer Function

```javascript
const { app } = require('@azure/functions');

app.timer('TimerTrigger', {
    schedule: '0 */5 * * * *', // Every 5 minutes
    handler: async (myTimer, context) => {
        context.log('Timer trigger executed at:', new Date().toISOString());
    }
});
```

## Pattern 3: Create Azure Resources

Create the required Azure resources for deployment.

```bash
# Set variables
RESOURCE_GROUP="myResourceGroup"
LOCATION="eastus"
STORAGE_ACCOUNT="mystorageaccount$(date +%s)"
FUNCTION_APP="myFunctionApp$(date +%s)"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account (required for Function Apps)
az storage account create \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku Standard_LRS

# Create Function App (Consumption Plan - pay per execution)
az functionapp create \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT \
    --consumption-plan-location $LOCATION \
    --runtime node \
    --runtime-version 20 \
    --functions-version 4
```

### Hosting Plans

| Plan | Use Case | Scaling |
|------|----------|---------|
| **Consumption** | Event-driven, variable load | Auto-scale, pay per execution |
| **Premium** | Enhanced performance, VNET | Pre-warmed instances |
| **Dedicated (App Service)** | Predictable workloads | Manual/auto-scale |

```bash
# Create with Premium Plan
az functionapp plan create \
    --name myPremiumPlan \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku EP1 \
    --is-linux

az functionapp create \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT \
    --plan myPremiumPlan \
    --runtime node \
    --runtime-version 20 \
    --functions-version 4
```

## Pattern 4: Deploy Functions

Deploy functions to Azure using Azure Functions Core Tools.

```bash
# Deploy to Azure (from project root)
func azure functionapp publish $FUNCTION_APP

# Deploy with build (for TypeScript/compiled projects)
func azure functionapp publish $FUNCTION_APP --build remote

# Deploy with verbose output
func azure functionapp publish $FUNCTION_APP --verbose
```

### Deployment Options

```bash
# Deploy using zip deployment
func azure functionapp publish $FUNCTION_APP --zip

# Deploy specific slot
func azure functionapp publish $FUNCTION_APP --slot staging

# Force update function app settings
func azure functionapp publish $FUNCTION_APP --publish-settings-only
```

## Pattern 5: Configuration Management

Manage application settings and connection strings.

```bash
# Set application setting
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings "MySetting=MyValue"

# Set connection string
az functionapp config connection-string set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --connection-string-type SQLAzure \
    --settings "MyConnection=Server=..."

# List settings
az functionapp config appsettings list \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP

# Upload local.settings.json to Azure
func azure functionapp publish $FUNCTION_APP --publish-local-settings
```

### local.settings.json

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "MY_API_KEY": "local-dev-key"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*"
  }
}
```

## Pattern 6: Monitoring and Logs

View function execution logs and diagnostics.

```bash
# Stream live logs
func azure functionapp logstream $FUNCTION_APP

# View logs in portal
az functionapp log show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP

# Enable Application Insights (recommended)
az monitor app-insights component create \
    --app $FUNCTION_APP-insights \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP

# Link App Insights to Function App
APPINSIGHTS_KEY=$(az monitor app-insights component show \
    --app $FUNCTION_APP-insights \
    --resource-group $RESOURCE_GROUP \
    --query instrumentationKey -o tsv)

az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$APPINSIGHTS_KEY"
```

## Pattern 7: Deployment Slots (Premium/Dedicated Plans)

Use deployment slots for zero-downtime deployments.

```bash
# Create staging slot
az functionapp deployment slot create \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --slot staging

# Deploy to staging
func azure functionapp publish $FUNCTION_APP --slot staging

# Swap slots
az functionapp deployment slot swap \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --slot staging \
    --target-slot production
```

## Pattern 8: CI/CD with GitHub Actions

Automate deployments with GitHub Actions.

`.github/workflows/azure-functions.yml`:
```yaml
name: Deploy Azure Functions

on:
  push:
    branches: [main]

env:
  AZURE_FUNCTIONAPP_NAME: 'myFunctionApp'
  AZURE_FUNCTIONAPP_PACKAGE_PATH: '.'
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
      
      - name: Install dependencies
        run: npm ci
        working-directory: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
      
      - name: Build (if TypeScript)
        run: npm run build --if-present
        working-directory: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
      
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
          package: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
```

**Create Azure credentials secret:**
```bash
az ad sp create-for-rbac --name "github-actions-sp" \
    --role contributor \
    --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group} \
    --sdk-auth
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Use managed identity** | Prefer managed identity over connection strings for secure resource access |
| **Configure timeout** | Set `functionTimeout` in host.json (default 5 min for Consumption) |
| **Use Application Insights** | Enable for monitoring, tracing, and diagnostics |
| **Secure HTTP functions** | Use `authLevel: 'function'` or `'admin'` for non-public endpoints |
| **Environment variables** | Store secrets in App Settings, not in code |
| **Cold start optimization** | Use Premium plan or keep-alive pings for latency-sensitive apps |
| **Durable Functions** | Use for long-running orchestrations and stateful workflows |

## Quick Start Checklist

### Setup
- [ ] Azure subscription created
- [ ] Azure CLI installed (`az --version`)
- [ ] Azure CLI authenticated (`az login`)
- [ ] Azure Functions Core Tools installed (`func --version`)
- [ ] Node.js/Python/dotnet installed (based on runtime)

### Development
- [ ] Initialize project with `func init`
- [ ] Create functions with `func new`
- [ ] Configure `host.json` settings
- [ ] Test locally with `func start`

### Deployment
- [ ] Create resource group
- [ ] Create storage account
- [ ] Create Function App
- [ ] Deploy with `func azure functionapp publish`
- [ ] Configure app settings
- [ ] Verify function URLs

### Monitoring
- [ ] Enable Application Insights
- [ ] Stream logs with `func azure functionapp logstream`
- [ ] Set up alerts for failures

## Azure Resources

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.Web/sites` | Function App | 2023-12-01 |
| `Microsoft.Storage/storageAccounts` | Required storage | 2023-01-01 |
| `Microsoft.Web/serverfarms` | App Service Plan | 2023-12-01 |
| `Microsoft.Insights/components` | Application Insights | 2020-02-02 |

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| **func not found** | Command not recognized | Install Azure Functions Core Tools: `npm install -g azure-functions-core-tools@4` |
| **Storage error** | Function app won't start | Verify `AzureWebJobsStorage` connection string is valid |
| **404 on function** | Function not found | Check function is exported correctly and route is configured |
| **Cold start delays** | First request slow | Use Premium plan or implement warm-up triggers |
| **Timeout** | Function exceeds limit | Increase `functionTimeout` in host.json or use Durable Functions |
| **Binding errors** | Extension not loaded | Run `func extensions install` to install required extensions |
| **Deploy fails** | Publish error | Ensure function app exists and CLI is authenticated |
| **Runtime mismatch** | Version conflict | Verify `FUNCTIONS_EXTENSION_VERSION` matches project |

**Debug commands:**
```bash
func start --verbose                     # Local debugging
func azure functionapp logstream $APP    # Live logs
az functionapp show --name $APP          # App details
az functionapp config show --name $APP   # Configuration
```

## Additional Resources

- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- [Triggers and Bindings](https://learn.microsoft.com/azure/azure-functions/functions-triggers-bindings)
- [Durable Functions](https://learn.microsoft.com/azure/azure-functions/durable/)
