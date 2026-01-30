# Azure Logic Apps

Workflow patterns and best practices for Azure Logic Apps.

## When to Use

- Integration-heavy workloads
- Business process automation
- Connecting multiple SaaS services
- Approval and human workflow processes
- Low-code/visual workflow design
- Event-driven orchestration

## Service Type in azure.yaml

Logic Apps are typically deployed as infrastructure, not as application services.

```yaml
# Logic Apps are defined in Bicep infrastructure
```

## Bicep Resource Pattern

### Consumption (Multi-tenant)

```bicep
resource logicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: '${resourcePrefix}-logic-${uniqueHash}'
  location: location
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      triggers: {
        manual: {
          type: 'Request'
          kind: 'Http'
          inputs: {
            schema: {}
          }
        }
      }
      actions: {}
    }
    parameters: {}
  }
}
```

### Standard (Single-tenant)

```bicep
resource logicAppPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-logicplan-${uniqueHash}'
  location: location
  sku: {
    name: 'WS1'
    tier: 'WorkflowStandard'
  }
  properties: {
    reserved: true
  }
}

resource logicAppStandard 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-logic-${uniqueHash}'
  location: location
  kind: 'functionapp,workflowapp'
  properties: {
    serverFarmId: logicAppPlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
      ]
    }
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| Storage Account | Workflow state (Standard only) |
| Log Analytics | Monitoring |
| API Connections | External service connections |

## Common Triggers

### HTTP Request

```json
{
  "triggers": {
    "manual": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "schema": {
          "type": "object",
          "properties": {
            "orderId": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### Recurrence (Schedule)

```json
{
  "triggers": {
    "Recurrence": {
      "type": "Recurrence",
      "recurrence": {
        "frequency": "Hour",
        "interval": 1
      }
    }
  }
}
```

### Service Bus Queue

```json
{
  "triggers": {
    "When_a_message_is_received": {
      "type": "ApiConnection",
      "inputs": {
        "host": {
          "connection": {
            "name": "@parameters('$connections')['servicebus']['connectionId']"
          }
        },
        "method": "get",
        "path": "/@{encodeURIComponent('orders')}/messages/head"
      }
    }
  }
}
```

## API Connections

```bicep
resource serviceBusConnection 'Microsoft.Web/connections@2016-06-01' = {
  name: 'servicebus-connection'
  location: location
  properties: {
    displayName: 'Service Bus Connection'
    api: {
      id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'servicebus')
    }
    parameterValues: {
      connectionString: serviceBus.listKeys().primaryConnectionString
    }
  }
}
```

## Common Actions

### Send Email (Office 365)

```json
{
  "Send_an_email": {
    "type": "ApiConnection",
    "inputs": {
      "host": {
        "connection": {
          "name": "@parameters('$connections')['office365']['connectionId']"
        }
      },
      "method": "post",
      "path": "/v2/Mail",
      "body": {
        "To": "@triggerBody()?['email']",
        "Subject": "Order Confirmation",
        "Body": "Your order has been received."
      }
    }
  }
}
```

### HTTP Action

```json
{
  "HTTP": {
    "type": "Http",
    "inputs": {
      "method": "POST",
      "uri": "https://api.example.com/orders",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "@triggerBody()"
    }
  }
}
```

## Approval Workflows

```json
{
  "Send_approval_email": {
    "type": "ApiConnectionWebhook",
    "inputs": {
      "host": {
        "connection": {
          "name": "@parameters('$connections')['office365']['connectionId']"
        }
      },
      "body": {
        "NotificationUrl": "@{listCallbackUrl()}",
        "Message": {
          "To": "approver@example.com",
          "Subject": "Approval Required",
          "Options": "Approve, Reject"
        }
      },
      "path": "/approvalmail/$subscriptions"
    }
  }
}
```

## Consumption vs Standard

| Feature | Consumption | Standard |
|---------|-------------|----------|
| Pricing | Per execution | App Service Plan |
| VNET | Limited | Full support |
| State | Azure-managed | Custom storage |
| Deployment | ARM/Bicep | VS Code deployment |
| Multi-workflow | One per resource | Multiple per app |
