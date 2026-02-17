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

## Terraform Configuration

> **💡 ALWAYS USE FLEX CONSUMPTION** with Terraform for new Function App deployments.

When using Terraform (especially with azd+Terraform), reference the **Azure Verified Modules (AVM)** for up-to-date Flex Consumption patterns:

**Primary Reference:** [AVM Web Site Module - Flex Consumption Example](https://registry.terraform.io/modules/Azure/avm-res-web-site/azurerm/latest/examples/flex_consumption)

Key points for Terraform:
- Use **azurerm provider v4.x or later** for Flex Consumption support
- Reference the AVM module for current best practices
- Include `azd-service-name` tags for azd integration (see [azd+Terraform guide](../recipes/azd/terraform.md))

**Example Terraform configuration:**
```hcl
# See the AVM module documentation for complete, up-to-date examples:
# https://registry.terraform.io/modules/Azure/avm-res-web-site/azurerm/latest/examples/flex_consumption

module "function_app" {
  source  = "Azure/avm-res-web-site/azurerm"
  version = "~> 0.1" # Check registry for latest version

  # Flex Consumption configuration
  kind                      = "functionapp,linux"
  os_type                   = "Linux"
  name                      = "func-${var.environment_name}-${var.service_name}"
  location                  = var.location
  resource_group_name       = azurerm_resource_group.main.name
  
  # Required for azd integration
  tags = {
    "azd-service-name" = var.service_name
  }

  # See AVM module documentation for additional required parameters
}
```

> **⚠️ NOTE**: The AVM module documentation is updated regularly. Always check the [Flex Consumption example](https://registry.terraform.io/modules/Azure/avm-res-web-site/azurerm/latest/examples/flex_consumption) for the latest configuration patterns.

## Runtime Stacks

> **⚠️ ALWAYS QUERY OFFICIAL DOCUMENTATION**
>
> Do NOT use hardcoded versions. Query for latest GA versions:
>
> **Primary Source:** [Azure Functions Supported Languages](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages)

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
        version: '22'
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