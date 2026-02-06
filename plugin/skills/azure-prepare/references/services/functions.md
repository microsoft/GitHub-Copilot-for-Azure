# Azure Functions

Hosting patterns and best practices for Azure Functions.

## When to Use

- Event-driven workloads
- Scheduled tasks (cron jobs)
- HTTP APIs with variable traffic
- Message/queue processing
- Real-time file processing
- Serverless compute preference

## AZD Template Selection

**IMPORTANT**: When using AZD recipe, select the appropriate template based on your project needs.

See [functions-templates.md](../recipes/azd/functions-templates.md) for:
- Template selection decision tree
- MCP Server templates
- Integration templates (Cosmos DB, SQL, AI)
- HTTP function templates by runtime
- Template initialization guidance

## Service Type in azure.yaml

```yaml
services:
  my-function:
    host: function
    project: ./src/my-function
```

## Bicep Resource Pattern

> **⚠️ IMPORTANT**: Always use Flex Consumption plan (FC1) for new Azure Functions deployments.

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${resourcePrefix}func${uniqueHash}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

resource functionAppPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${resourcePrefix}-funcplan-${uniqueHash}'
  location: location
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  kind: 'functionapp,linux'
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: functionAppPlan.id
    siteConfig: {
      linuxFxVersion: 'Node|20'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}'
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
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
      ]
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| Storage Account | Function runtime state |
| Application Insights | Monitoring |
| App Service Plan | Hosting (Flex Consumption recommended) |

## Hosting Plans

> **💡 ALWAYS USE FLEX CONSUMPTION** for new deployments. All azd templates use Flex Consumption by default.

| Plan | Scaling | VNET Support | Use Case |
|------|---------|--------------|----------|
| **Flex Consumption (FC1)** ⭐ | Auto, pay-per-execution | ✅ | **Recommended for all new projects** |
| Premium (EP1-EP3) | Auto, pre-warmed instances | ✅ | Long-running, consistent load, no cold starts |
| Dedicated (B1-P3v3) | Manual or auto | ✅ | Predictable workloads, shared App Service |

> **⚠️ NOTE**: Traditional Consumption (Y1) is being phased out. Use Flex Consumption instead.

## Trigger Types

### HTTP Trigger

```javascript
module.exports = async function (context, req) {
    context.res = {
        body: "Hello from Azure Functions"
    };
};
```

### Timer Trigger

```javascript
// function.json
{
  "bindings": [
    {
      "name": "timer",
      "type": "timerTrigger",
      "schedule": "0 */5 * * * *"  // Every 5 minutes
    }
  ]
}
```

### Queue Trigger

```javascript
// function.json
{
  "bindings": [
    {
      "name": "queueItem",
      "type": "serviceBusTrigger",
      "queueName": "orders",
      "connection": "ServiceBusConnection"
    }
  ]
}
```

### Blob Trigger

```javascript
// function.json
{
  "bindings": [
    {
      "name": "blob",
      "type": "blobTrigger",
      "path": "uploads/{name}",
      "connection": "StorageConnection"
    }
  ]
}
```

## Runtime Stacks

> **⚠️ ALWAYS QUERY OFFICIAL DOCUMENTATION**
>
> Do NOT use hardcoded versions. Query for latest GA versions:
>
> **Primary Source:** [Azure Functions Supported Languages](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages)

**Latest GA Versions (as of 2026):**

| Language | FUNCTIONS_WORKER_RUNTIME | Recommended linuxFxVersion | Notes |
|----------|-------------------------|---------------------------|-------|
| Node.js | `node` | `Node\|20` or `Node\|24` | Node 18 EOL in 2025 |
| Python | `python` | `Python\|3.11`, `Python\|3.12`, or `Python\|3.13` | Python 3.10 EOL Oct 2026 |
| .NET | `dotnet` | `DOTNET\|8.0` or `DOTNET\|9` | .NET 9 EOL Nov 2026 |
| Java | `java` | `Java\|17`, `Java\|21`, or `Java\|25` | Use LTS versions |
| PowerShell | `powershell` | `PowerShell\|7.4` | PowerShell 7.2+ supported |

## Cold Start Mitigation

### Flex Consumption - Always Ready Instances

Configure always-ready instances in Flex Consumption for critical workloads:

```bicep
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: functionAppPlan.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}deploymentpackage'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        alwaysReady: [
          {
            name: 'http'
            instanceCount: 2
          }
        ]
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
  }
}
```

### Premium Plan - Minimum Instances

For Premium plan, configure minimum instances:

```bicep
resource functionAppPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${resourcePrefix}-funcplan-${uniqueHash}'
  location: location
  sku: {
    name: 'EP1'
    tier: 'ElasticPremium'
  }
  properties: {
    reserved: true
    minimumElasticInstanceCount: 1
  }
}
```

## Durable Functions

For long-running orchestrations:

```javascript
const df = require('durable-functions');

module.exports = df.orchestrator(function* (context) {
    const result1 = yield context.df.callActivity('Step1');
    const result2 = yield context.df.callActivity('Step2', result1);
    return result2;
});
```

## AZD Deployment Requirements

When creating Azure Functions with azd deployment, ensure the following:

### 1. Consistent Service Naming

**CRITICAL**: Service names must be consistent across all deployment files.

- The service name in `azure.yaml` must match the `serviceName` parameter in Bicep
- The Bicep module must tag the Function App with `azd-service-name: serviceName`
- Common pattern: use `api` as the service name for Function apps

**Example:**

`azure.yaml`:
```yaml
services:
  api:                    # Service name
    host: function
    project: ./src/api
```

`infra/main.bicep`:
```bicep
module functionApp './modules/function-app.bicep' = {
  params: {
    serviceName: 'api'    // Must match azure.yaml service name
    // ...
  }
}
```

`infra/modules/function-app.bicep`:
```bicep
param serviceName string

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  tags: union(tags, { 'azd-service-name': serviceName })  # Required tag
  // ...
}
```

### 2. Always Create main.parameters.json

**CRITICAL**: Generate `main.parameters.json` to map Bicep parameters to azd environment variables.

Minimum required mappings:
```json
{
  "$schema": "https://json.schemastore.org/bicep-parameters.json",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": {
      "value": "${AZURE_ENV_NAME}"
    },
    "location": {
      "value": "${AZURE_LOCATION}"
    }
  }
}
```

### 3. Pre-Deployment Verification

Before running `azd up`, verify:
- [ ] `azure.yaml` service names align with Bicep `azd-service-name` tags
- [ ] `infra/main.parameters.json` exists with required parameter mappings
- [ ] All required Bicep parameters have corresponding mappings