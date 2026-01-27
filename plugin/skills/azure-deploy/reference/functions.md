# Azure Functions Deployment Guide

Comprehensive guide for deploying serverless functions to Azure Functions.

---

## Overview

Azure Functions is a serverless compute service for running event-driven code. Use Functions for:

- Event-driven processing (HTTP triggers, timers, queues, etc.)
- Microservices and APIs
- Data processing and transformation
- Integration workflows
- Background tasks

---

## Quick Start

```bash
# 1. Create resource group
az group create --name myfunc-rg --location eastus

# 2. Create storage account (required)
az storage account create \
  --name myfuncstorage \
  --resource-group myfunc-rg \
  --location eastus \
  --sku Standard_LRS

# 3. Create Function App
az functionapp create \
  --name myfunc \
  --resource-group myfunc-rg \
  --storage-account myfuncstorage \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 22 \
  --functions-version 4

# 4. Deploy
func azure functionapp publish myfunc
```

---

## Hosting Plans

### Plan Comparison

| Plan | Best For | Scaling | Cost |
|------|----------|---------|------|
| **Consumption** | Sporadic workloads, dev/test | Auto (0-200 instances) | Pay per execution |
| **Premium** | Production, VNET, longer execution | Auto (1-100 instances) | Per second + instances |
| **Dedicated** | Existing App Service plan | Manual or auto | Plan-based |

### Create with Consumption Plan (Default)

```bash
az functionapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --storage-account <storage-name> \
  --consumption-plan-location <location> \
  --runtime <runtime> \
  --runtime-version <version> \
  --functions-version 4
```

### Create with Premium Plan

```bash
# Create Premium plan
az functionapp plan create \
  --name <plan-name> \
  --resource-group <resource-group> \
  --location <location> \
  --sku EP1 \
  --is-linux

# Create Function App on Premium plan
az functionapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --storage-account <storage-name> \
  --plan <plan-name> \
  --runtime <runtime> \
  --runtime-version <version> \
  --functions-version 4
```

### Create with Dedicated Plan

```bash
# Use existing App Service plan
az functionapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --storage-account <storage-name> \
  --plan <existing-plan-name> \
  --runtime <runtime> \
  --runtime-version <version> \
  --functions-version 4
```

---

## Runtime Configuration

### Supported Runtimes

**Node.js (use LTS versions):**
```bash
--runtime node --runtime-version 22   # LTS - Recommended (EOL: April 2027)
--runtime node --runtime-version 20   # LTS (EOL: April 2026)
```

**Python:**
```bash
--runtime python --runtime-version 3.10
--runtime python --runtime-version 3.11
```

**.NET:**
```bash
--runtime dotnet --runtime-version 6  # .NET 6 (in-process)
--runtime dotnet-isolated --runtime-version 8  # .NET 8 (isolated)
```

**Java:**
```bash
--runtime java --runtime-version 11
--runtime java --runtime-version 17
--runtime java --runtime-version 21
```

**PowerShell:**
```bash
--runtime powershell --runtime-version 7.2
--runtime powershell --runtime-version 7.4
```

---

## Prerequisites Validation

**Validate and auto-install dependencies before deployment:**

```bash
# Check Azure Functions Core Tools
func --version

# If not found, install automatically
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

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

**Key insight**: Azure Functions Core Tools (`func`) is required for local development and deployment. Always validate and auto-install if missing.

## Local Development

### Create New Project

```bash
# Initialize project (v4 model for Node.js/Python - recommended)
func init MyFunctionProject --worker-runtime node --model V4

# For TypeScript
func init MyFunctionProject --worker-runtime node --language typescript --model V4

# For Python v2 model
func init MyFunctionProject --worker-runtime python --model V2

# Create a function
cd MyFunctionProject
func new --name MyHttpFunction --template "HTTP trigger"

# For timer-triggered function
func new --name MyTimerFunction --template "Timer trigger"
```

### Run Locally

```bash
# Start local runtime
func start

# With specific port
func start --port 7071

# With CORS enabled
func start --cors "*"
```

### Project Structure

```
MyFunctionProject/
├── host.json                 # Global configuration
├── local.settings.json       # Local app settings (gitignored)
├── package.json              # (Node.js)
├── requirements.txt          # (Python)
├── MyHttpFunction/
│   ├── function.json         # Function configuration (v1 model)
│   └── index.js              # Function code
└── function_app.py           # (Python v2 model - all functions in one file)
```

---

## Programming Models

### Node.js (v4 Model - Recommended)

```javascript
// src/functions/httpTrigger.js
const { app } = require('@azure/functions');

app.http('httpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const name = request.query.get('name') || 'World';
        return { body: `Hello, ${name}!` };
    }
});
```

### Python (v2 Model - Recommended)

```python
# function_app.py
import azure.functions as func

app = func.FunctionApp()

@app.route(route="hello", auth_level=func.AuthLevel.ANONYMOUS)
def hello(req: func.HttpRequest) -> func.HttpResponse:
    name = req.params.get('name', 'World')
    return func.HttpResponse(f"Hello, {name}!")

@app.timer_trigger(schedule="0 */5 * * * *", arg_name="timer")
def timer_function(timer: func.TimerRequest) -> None:
    logging.info('Timer trigger executed')
```

### .NET (Isolated Model - Recommended)

```csharp
// HttpTrigger.cs
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

public class HttpTrigger
{
    [Function("HttpTrigger")]
    public HttpResponseData Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post")] 
        HttpRequestData req)
    {
        var response = req.CreateResponse(HttpStatusCode.OK);
        response.WriteString("Hello, World!");
        return response;
    }
}
```

---

## Deployment

### Deploy with func CLI (Recommended)

```bash
# Build and deploy
func azure functionapp publish <app-name>

# Deploy with build
func azure functionapp publish <app-name> --build remote

# Python with requirements
func azure functionapp publish <app-name> --build remote --python
```

### Deploy from Zip

```bash
# Create deployment package
zip -r deploy.zip . -x "*.git*" -x "local.settings.json"

# Deploy
az functionapp deployment source config-zip \
  --name <app-name> \
  --resource-group <resource-group> \
  --src deploy.zip
```

### Deploy from Git

```bash
az functionapp deployment source config \
  --name <app-name> \
  --resource-group <resource-group> \
  --repo-url <git-repo-url> \
  --branch main \
  --manual-integration
```

---

## Application Settings

### Set Environment Variables

```bash
# Set settings
az functionapp config appsettings set \
  --name <app-name> \
  --resource-group <resource-group> \
  --settings \
    MY_SETTING=value \
    CONNECTION_STRING="<value>"

# View settings
az functionapp config appsettings list \
  --name <app-name> \
  --resource-group <resource-group> \
  --output table
```

### Required Settings

Functions automatically configure these, but you may need to update:

```bash
# Storage connection (auto-configured)
AzureWebJobsStorage="<connection-string>"

# Functions runtime
FUNCTIONS_WORKER_RUNTIME="node"  # or python, dotnet, java

# Node.js specific
WEBSITE_NODE_DEFAULT_VERSION="~20"
```

### local.settings.json

For local development:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "MY_CUSTOM_SETTING": "value"
  },
  "Host": {
    "CORS": "*"
  }
}
```

---

## host.json Configuration

Global settings for all functions:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    },
    "logLevel": {
      "default": "Information",
      "Host.Results": "Error",
      "Function": "Information"
    }
  },
  "functionTimeout": "00:10:00",
  "extensions": {
    "http": {
      "routePrefix": "api",
      "maxOutstandingRequests": 200,
      "maxConcurrentRequests": 100
    }
  }
}
```

---

## Trigger Types

### HTTP Trigger

```javascript
app.http('api', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',  // or 'function', 'admin'
    route: 'items/{id?}',
    handler: async (request, context) => { ... }
});
```

### Timer Trigger

```javascript
// Run every 5 minutes
app.timer('timerTrigger', {
    schedule: '0 */5 * * * *',
    handler: async (timer, context) => { ... }
});
```

### Queue Trigger

```javascript
app.storageQueue('queueTrigger', {
    queueName: 'myqueue',
    connection: 'AzureWebJobsStorage',
    handler: async (message, context) => { ... }
});
```

### Blob Trigger

```javascript
app.storageBlob('blobTrigger', {
    path: 'container/{name}',
    connection: 'AzureWebJobsStorage',
    handler: async (blob, context) => { ... }
});
```

### Service Bus Trigger

```javascript
app.serviceBusQueue('serviceBusTrigger', {
    queueName: 'myqueue',
    connection: 'ServiceBusConnection',
    handler: async (message, context) => { ... }
});
```

---

## Bindings

### Output Bindings

```javascript
// HTTP trigger with Queue output
app.http('createItem', {
    methods: ['POST'],
    authLevel: 'anonymous',
    return: output.storageQueue({
        queueName: 'items-queue',
        connection: 'AzureWebJobsStorage'
    }),
    handler: async (request, context) => {
        const item = await request.json();
        return { body: 'Created', jsonBody: item }; // item goes to queue
    }
});
```

---

## Monitoring

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app <insights-name> \
  --location <location> \
  --resource-group <resource-group>

# Get connection string (preferred over instrumentation key)
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
  --app <insights-name> \
  --resource-group <resource-group> \
  --query connectionString -o tsv)

# Set on Function App (use connection string - instrumentationKey is deprecated)
az functionapp config appsettings set \
  --name <app-name> \
  --resource-group <resource-group> \
  --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION_STRING"
```

### View Logs

```bash
# Stream logs
func azure functionapp logstream <app-name>

# Or via az CLI
az webapp log tail \
  --name <app-name> \
  --resource-group <resource-group>
```

---

## Durable Functions

For stateful workflows:

```javascript
// Orchestrator
df.app.orchestration('orchestrator', function* (context) {
    const result1 = yield context.df.callActivity('activity1', 'input1');
    const result2 = yield context.df.callActivity('activity2', result1);
    return result2;
});

// Activity
df.app.activity('activity1', {
    handler: async (input) => {
        return `Processed: ${input}`;
    }
});

// HTTP Starter
app.http('startOrchestration', {
    methods: ['POST'],
    handler: async (request, context) => {
        const client = df.getClient(context);
        const instanceId = await client.startNew('orchestrator', { input: 'data' });
        return client.createCheckStatusResponse(request, instanceId);
    }
});
```

---

## Cleanup

```bash
# Delete Function App
az functionapp delete \
  --name <app-name> \
  --resource-group <resource-group>

# Delete resource group (removes all resources)
az group delete --name <resource-group> --yes
```
