# Azure Functions Deployment Guide

Complete reference for deploying serverless functions to Azure Function Apps using `azd` (Azure Developer CLI) and Azure Functions Core Tools.

---

## Overview

Azure Functions is a serverless compute service that enables you to run event-driven code without managing infrastructure. This guide provides comprehensive deployment workflows for serverless applications.

**Key Benefits:**
- **Serverless execution** - Pay only for execution time
- **Event-driven** - Respond to triggers from various Azure services
- **Multiple languages** - Node.js, Python, .NET, Java, PowerShell
- **Integrated bindings** - Simplified connections to Azure services
- **Flexible hosting** - Consumption, Premium, or Dedicated plans

**When to use Azure Functions:**
- **Serverless APIs** - HTTP-triggered functions for REST endpoints
- **Background processing** - Queue-triggered functions for async workloads
- **Scheduled tasks** - Timer-triggered functions for cron-like jobs
- **Event handlers** - Blob, Event Grid, or Service Bus triggered functions
- **Webhooks** - HTTP endpoints for third-party integrations
- **Data processing** - Transform and process data in real-time

**Deployment Workflow:**
```
Init → Develop → Test Locally → azd up → Monitor
```

---

## Always Use azd for Deployments

> **Always use `azd` (Azure Developer CLI) for Azure provisioning and Functions deployments.**
> The `azd` tool provides a complete, reproducible deployment workflow for all Functions scenarios.

```bash
# Deploy everything in one command
azd up --no-prompt

# Or step-by-step:
azd init                    # Create azure.yaml and infra/
azd provision --no-prompt   # Create Function App, Storage, and dependencies
azd deploy --no-prompt      # Deploy function code

# Preview changes before deployment
azd provision --preview

# Clean up test environments
azd down --force --purge
```

> ⚠️ **CRITICAL: `azd down` Data Loss Warning**
>
> `azd down` **permanently deletes ALL resources** including Function Apps, Storage accounts, and Key Vaults.
> Always back up important data before running `azd down`.

**Why azd is required:**
- **Parallel provisioning** - Deploys in seconds, not minutes
- **Single command** - `azd up` replaces 5+ commands
- **Infrastructure as Code** - Reproducible with Bicep
- **Environment management** - Easy dev/staging/prod separation
- **Consistent workflow** - Same commands work across all Azure services

---

## Prerequisites and Validation

### Pattern 0: Prerequisites Validation

**Always validate all prerequisites before starting deployment.**

```javascript
async function validatePrerequisites() {
  const checks = [];
  
  // Check azd authentication
  try {
    await exec('azd auth login --check-status');
    checks.push({ name: 'Azure Developer CLI', status: 'authenticated' });
  } catch (error) {
    throw new Error('Not authenticated with Azure Developer CLI. Run: azd auth login');
  }
  
  // Check Azure Functions Core Tools - install if not present
  try {
    await exec('func --version');
    checks.push({ name: 'Azure Functions Core Tools', status: 'installed' });
  } catch (error) {
    console.log('Azure Functions Core Tools not found. Installing...');
    try {
      await exec('npm install -g azure-functions-core-tools@4 --unsafe-perm true');
      checks.push({ name: 'Azure Functions Core Tools', status: 'installed (just now)' });
    } catch (installError) {
      throw new Error('Failed to install Azure Functions Core Tools. Please install manually: npm install -g azure-functions-core-tools@4');
    }
  }
  
  return checks;
}
```

**Key insight**: Azure Functions Core Tools (`func`) is required for local development and deployment. The validation will attempt automatic installation via npm if not found.

### Platform-Specific Installation

If npm installation fails, use platform-specific installers:

```bash
# Windows (winget)
winget install Microsoft.AzureFunctionsCoreTools

# Windows (Chocolatey)
choco install azure-functions-core-tools

# macOS (Homebrew)
brew tap azure/functions
brew install azure-functions-core-tools@4

# Linux (Ubuntu/Debian)
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs)-prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list'
sudo apt-get update
sudo apt-get install azure-functions-core-tools-4
```

### Prerequisites Checklist

**Setup:**
- [ ] Azure subscription created
- [ ] Azure Developer CLI installed (`azd version`)
- [ ] Azure Developer CLI authenticated (`azd auth login`)
- [ ] Azure Functions Core Tools installed (`func --version`)
- [ ] Node.js/Python/.NET installed (based on runtime)

---

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

# For Python
func init MyFunctionApp --worker-runtime python --model V2

# For .NET
func init MyFunctionApp --worker-runtime dotnet-isolated
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

### host.json Configuration

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "functionTimeout": "00:05:00",
  "extensions": {
    "http": {
      "routePrefix": "api"
    }
  }
}
```

---

## Pattern 2: Local Development

Test functions locally before deploying.

```bash
# Start local development server
func start

# Start with specific port
func start --port 7072

# Start with debugging enabled
func start --verbose

# Start with specific language worker
func start --python
```

**Local endpoints:**
- HTTP triggers: `http://localhost:7071/api/{functionName}`
- Admin API: `http://localhost:7071/admin/functions`

### Example Functions

#### HTTP Function (Node.js v4)

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

#### Timer Function

```javascript
const { app } = require('@azure/functions');

app.timer('TimerTrigger', {
    schedule: '0 */5 * * * *', // Every 5 minutes
    handler: async (myTimer, context) => {
        context.log('Timer trigger executed at:', new Date().toISOString());
    }
});
```

#### Queue Trigger Function

```javascript
const { app } = require('@azure/functions');

app.storageQueue('QueueTrigger', {
    queueName: 'myqueue',
    connection: 'AzureWebJobsStorage',
    handler: async (message, context) => {
        context.log('Queue message:', message);
    }
});
```

#### Blob Trigger Function

```javascript
const { app } = require('@azure/functions');

app.storageBlob('BlobTrigger', {
    path: 'samples/{name}',
    connection: 'AzureWebJobsStorage',
    handler: async (blob, context) => {
        context.log('Blob name:', context.triggerMetadata.name);
        context.log('Blob size:', blob.length);
    }
});
```

---

## Pattern 3: Create Azure Resources

### Using azd (Required)

```bash
# Initialize project with azure.yaml
azd init

# Provision infrastructure and deploy
azd up --no-prompt

# Or step-by-step:
azd provision --no-prompt   # Create Function App, Storage, App Insights
azd deploy --no-prompt      # Deploy function code
```

### Hosting Plans

Configure hosting plan in your Bicep templates under `infra/`:

| Plan | Use Case | Scaling | Pricing |
|------|----------|---------|---------|
| **Consumption** | Event-driven, variable load | Auto-scale, scale to zero | Pay per execution |
| **Premium** | Enhanced performance, VNET | Pre-warmed instances | Fixed hourly rate |
| **Dedicated (App Service)** | Predictable workloads | Manual/auto-scale | App Service Plan pricing |

**Bicep example for Consumption plan (default):**
```bicep
resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: hostingPlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {}
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: hostingPlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'AzureWebJobsStorage', value: storageConnectionString }
      ]
    }
  }
}
```

**Bicep example for Premium plan:**
```bicep
resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'myPremiumPlan'
  location: location
  sku: {
    name: 'EP1'
    tier: 'ElasticPremium'
  }
  kind: 'elastic'
  properties: {
    reserved: true  // Linux
  }
}
```

**Bicep example for Dedicated plan:**
```bicep
resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'myAppServicePlan'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true  // Linux
  }
}
```

---

## Pattern 4: Deploy Functions

Deploy functions to Azure using azd or Azure Functions Core Tools.

### Using azd (Recommended)

```bash
# Deploy with azd
azd deploy --no-prompt

# Deploy to specific environment
azd deploy --environment staging --no-prompt
```

### Using func CLI

```bash
# Deploy to Azure (from project root)
func azure functionapp publish $FUNCTION_APP

# Deploy with build (for TypeScript/compiled projects)
func azure functionapp publish $FUNCTION_APP --build remote

# Deploy with verbose output
func azure functionapp publish $FUNCTION_APP --verbose

# Deploy with npm install on remote
func azure functionapp publish $FUNCTION_APP --build-native-deps
```

### Deployment Options

```bash
# Deploy using zip deployment
func azure functionapp publish $FUNCTION_APP

# Deploy specific slot
func azure functionapp publish $FUNCTION_APP --slot staging

# Force update function app settings from local.settings.json
func azure functionapp publish $FUNCTION_APP --publish-local-settings

# Publish settings only (no code)
func azure functionapp publish $FUNCTION_APP --publish-settings-only

# Overwrite existing settings
func azure functionapp publish $FUNCTION_APP --publish-local-settings --overwrite-settings
```

---

## Pattern 5: Configuration Management

Manage application settings using azd environment variables and Bicep.

### Using azd (Recommended)

```bash
# Set environment variables with azd
azd env set MY_SETTING "MyValue"
azd env set ANOTHER_SETTING "AnotherValue"

# Deploy with updated settings
azd deploy --no-prompt

# Upload local.settings.json to Azure
func azure functionapp publish $FUNCTION_APP --publish-local-settings
```

### Bicep Configuration

Define app settings in your Bicep template:

```bicep
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    siteConfig: {
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'MY_SETTING', value: mySetting }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
      ]
    }
  }
}
```

### local.settings.json

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "MY_API_KEY": "local-dev-key",
    "DATABASE_CONNECTION_STRING": "Server=localhost;..."
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*",
    "CORSCredentials": false
  },
  "ConnectionStrings": {
    "SQLConnectionString": "Server=localhost;..."
  }
}
```

---

## Pattern 6: Monitoring and Logs

View function execution logs and diagnostics.

### Using azd

```bash
# View logs from deployed functions
azd monitor --logs

# Open Azure Portal to view metrics
azd monitor --overview
```

### Using func CLI

```bash
# Stream live logs
func azure functionapp logstream $FUNCTION_APP

# Stream logs in browser
func azure functionapp logstream $FUNCTION_APP --browser
```

### Application Insights Integration

Application Insights is automatically configured when using azd. Define it in Bicep:

```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${functionAppName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

// Link to Function App via app settings in the functionApp resource
// { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
```

**Query Application Insights:**

```kusto
// Recent function executions
requests
| where timestamp > ago(1h)
| where cloud_RoleName == "my-function-app"
| project timestamp, name, duration, resultCode
| order by timestamp desc

// Failed executions
requests
| where timestamp > ago(1h)
| where success == false
| project timestamp, name, resultCode, customDimensions
| order by timestamp desc

// Function performance
requests
| where timestamp > ago(24h)
| summarize 
    Count = count(),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95)
    by name
| order by Count desc
```

---

## Pattern 7: Deployment Slots (Premium/Dedicated Plans)

Use deployment slots for zero-downtime deployments. Configure slots in Bicep and deploy with azd.

### Bicep Configuration

```bicep
resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: functionApp
  name: 'staging'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: hostingPlan.id
  }
}
```

### Deploy to Slots with azd

```bash
# Deploy to staging environment
azd deploy --environment staging --no-prompt

# After testing, promote to production
azd deploy --environment production --no-prompt
```

### Deploy with func CLI

```bash
# Deploy to staging slot
func azure functionapp publish $FUNCTION_APP --slot staging
```

---

## Pattern 8: CI/CD with GitHub Actions

Automate deployments with GitHub Actions.

**.github/workflows/azure-functions.yml:**
```yaml
name: Deploy Azure Functions

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AZURE_FUNCTIONAPP_NAME: 'myFunctionApp'
  AZURE_FUNCTIONAPP_PACKAGE_PATH: '.'
  NODE_VERSION: '20.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install dependencies
        run: npm ci
        working-directory: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
      
      - name: Build TypeScript (if applicable)
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

**Configure GitHub Actions with azd:**

Use `azd pipeline config` to set up GitHub Actions with proper credentials:

```bash
# Configure CI/CD pipeline
azd pipeline config
```

This automatically creates the necessary secrets and workflow configuration.

Add the output as `AZURE_CREDENTIALS` secret in GitHub repository settings.

---

## Triggers and Bindings

### Common Trigger Types

| Trigger | Description | Use Case |
|---------|-------------|----------|
| **HTTP** | Responds to HTTP requests | REST APIs, webhooks |
| **Timer** | Runs on schedule (cron) | Scheduled jobs, cleanup |
| **Queue** | Triggered by queue messages | Async processing |
| **Blob** | Triggered by blob uploads | File processing |
| **Event Grid** | Triggered by Event Grid events | Event-driven architecture |
| **Service Bus** | Triggered by Service Bus messages | Messaging patterns |
| **Cosmos DB** | Triggered by Cosmos DB changes | Change feed processing |

### Input/Output Bindings

```javascript
// HTTP trigger with Blob output binding
const { app } = require('@azure/functions');

app.http('HttpToBlobBinding', {
    methods: ['POST'],
    authLevel: 'function',
    extraOutputs: [
        {
            type: 'blob',
            name: 'outputBlob',
            path: 'output/{DateTime}.txt',
            connection: 'AzureWebJobsStorage'
        }
    ],
    handler: async (request, context) => {
        const data = await request.text();
        context.extraOutputs.set('outputBlob', data);
        return { body: 'Data saved to blob' };
    }
});
```

---

## Durable Functions

For long-running workflows and orchestrations.

```bash
# Install Durable Functions extension
npm install durable-functions
```

**Example orchestrator:**
```javascript
const df = require('durable-functions');

df.app.orchestration('HelloCitiesOrchestrator', function* (context) {
    const outputs = [];
    outputs.push(yield context.df.callActivity('SayHello', 'Tokyo'));
    outputs.push(yield context.df.callActivity('SayHello', 'Seattle'));
    outputs.push(yield context.df.callActivity('SayHello', 'Cairo'));
    return outputs;
});

df.app.activity('SayHello', {
    handler: (input) => {
        return `Hello, ${input}!`;
    }
});

df.app.http('StartOrchestration', {
    route: 'orchestrators/{orchestratorName}',
    extraInputs: [df.input.durableClient()],
    handler: async (request, context) => {
        const client = df.getClient(context);
        const instanceId = await client.startNew(
            request.params.orchestratorName
        );
        return client.createCheckStatusResponse(request, instanceId);
    }
});
```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Use managed identity** | Prefer managed identity over connection strings for secure resource access |
| **Configure timeout** | Set `functionTimeout` in host.json (default 5 min for Consumption, 30 min for Premium) |
| **Use Application Insights** | Enable for monitoring, tracing, and diagnostics |
| **Secure HTTP functions** | Use `authLevel: 'function'` or `'admin'` for non-public endpoints |
| **Environment variables** | Store secrets in App Settings or Key Vault, not in code |
| **Cold start optimization** | Use Premium plan or keep-alive pings for latency-sensitive apps |
| **Durable Functions** | Use for long-running orchestrations and stateful workflows |
| **Resource cleanup** | Implement proper exception handling and cleanup in functions |
| **Idempotency** | Design functions to handle duplicate messages gracefully |
| **Batch processing** | Process multiple items per invocation for queue/Service Bus triggers |
| **Connection pooling** | Reuse connections across function invocations |

---

## Troubleshooting

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **func not found** | Command not recognized | Install Azure Functions Core Tools: `npm install -g azure-functions-core-tools@4 --unsafe-perm true` |
| **Storage error** | Function app won't start | Verify `AzureWebJobsStorage` connection string is valid. Check storage account exists |
| **404 on function** | Function not found after deployment | Check function is exported correctly and route is configured. Verify deployment succeeded |
| **Cold start delays** | First request slow (5-10 seconds) | Use Premium plan with pre-warmed instances, or implement keep-alive ping |
| **Timeout** | Function exceeds time limit | Increase `functionTimeout` in host.json (max 10 min for Consumption). Consider Durable Functions for longer workflows |
| **Binding errors** | Extension not loaded | Run `func extensions install` to install required binding extensions |
| **Deploy fails** | Publish error | Ensure function app exists, CLI is authenticated, and storage account is accessible |
| **Runtime mismatch** | Version conflict | Verify `FUNCTIONS_EXTENSION_VERSION` (set to ~4) matches project functions version |
| **Missing dependencies** | Module not found | Ensure all dependencies are in package.json. Use `--build remote` for native dependencies |
| **High memory usage** | App crashes or restarts | Optimize function code, consider Premium plan with more memory |

### Debug Commands

```bash
# Local debugging with verbose output
func start --verbose

# Stream live logs from Azure
func azure functionapp logstream $FUNCTION_APP

# View logs with azd
azd monitor --logs

# Open Azure Portal for function app
azd monitor --overview
```

---

## Azure Resources Reference

### Core Resources for Azure Functions

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.Web/sites` | Function App | 2023-12-01 |
| `Microsoft.Storage/storageAccounts` | Required storage for function metadata | 2023-01-01 |
| `Microsoft.Web/serverfarms` | App Service Plan (for Premium/Dedicated) | 2023-12-01 |
| `Microsoft.Insights/components` | Application Insights for monitoring | 2020-02-02 |

### Example Bicep Template

```bicep
param location string = resourceGroup().location
param functionAppName string
param storageAccountName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${functionAppName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: null  // Consumption plan
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
      linuxFxVersion: 'NODE|20'
    }
  }
}
```

---

## Additional Resources

- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- [Triggers and Bindings](https://learn.microsoft.com/azure/azure-functions/functions-triggers-bindings)
- [Durable Functions](https://learn.microsoft.com/azure/azure-functions/durable/)
- [Best Practices](https://learn.microsoft.com/azure/azure-functions/functions-best-practices)
- [Performance and Reliability](https://learn.microsoft.com/azure/azure-functions/performance-reliability)
