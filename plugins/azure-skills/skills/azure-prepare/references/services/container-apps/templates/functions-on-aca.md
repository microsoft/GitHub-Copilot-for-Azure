# Functions on Container Apps — REFERENCE ONLY

Azure Functions hosted on Container Apps for event-driven triggers and bindings
with Container Apps scaling and networking.

## When to Use

- Event-driven processing requiring Functions triggers/bindings
- Need KEDA-based scaling with Functions programming model
- Want Container Apps networking (VNet, private endpoints) with Functions
- Migrating from Functions Consumption/Premium to Container Apps

## Why Functions on Container Apps?

| Feature | Functions (Flex) | Functions on ACA |
|---------|-----------------|------------------|
| Programming model | Functions v4 | Functions v4 |
| Triggers/bindings | ✅ Full support | ✅ Full support |
| Scaling | Flex Consumption | KEDA (Container Apps) |
| Networking | VNet integration | Container Apps VNet |
| Container support | Managed | Full Dockerfile control |
| Dapr integration | ❌ | ✅ |
| Side-cars | ❌ | ✅ |

## Project Structure

```
project-root/
├── azure.yaml
├── Dockerfile
├── host.json
├── src/
│   └── (Functions code)
└── infra/
    ├── main.bicep
    └── app/
        └── functions-app.bicep
```

## Dockerfile

```dockerfile
# Example: Node.js Functions on ACA
FROM mcr.microsoft.com/azure-functions/node:4-node20

ENV AzureWebJobsScriptRoot=/home/site/wwwroot
COPY . /home/site/wwwroot
RUN cd /home/site/wwwroot && npm install --production
```

## azure.yaml

```yaml
name: my-functions-aca
metadata:
  template: container-apps-functions
services:
  api:
    host: containerapp
    project: .
    language: js
```

## Bicep — Functions on Container Apps

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param envId string
param containerRegistryName string
param imageName string
param userAssignedIdentityId string
param uamiClientId string
param uamiPrincipalId string
param storageAccountName string

resource hostStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource hostStorageAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(hostStorage.id, uamiPrincipalId, 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')
  scope: hostStorage
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
    )
    principalId: uamiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource funcApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: name
  location: location
  kind: 'functionapp'
  tags: union(tags, { 'azd-service-name': 'api' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    managedEnvironmentId: envId
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: userAssignedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'functions'
          image: imageName
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            {
              name: 'AzureWebJobsStorage__accountName'
              value: storageAccountName
            }
            {
              name: 'AzureWebJobsStorage__credential'
              value: 'managedidentity'
            }
            {
              name: 'AzureWebJobsStorage__clientId'
              value: uamiClientId
            }
            {
              name: 'FUNCTIONS_EXTENSION_VERSION'
              value: '~4'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 30
      }
    }
  }
  dependsOn: [hostStorageAccess]
}

output principalId string = uamiPrincipalId
```

The host identity requires **Storage Blob Data Owner** on `AzureWebJobsStorage`. Add Storage
Queue Data Contributor for queue triggers. Blob triggers also require Storage Queue Data
Contributor and Storage Account Contributor. Add Storage Table Data Contributor when the
selected extension persists host or trigger state in tables.

## Supported Triggers

The platform generates KEDA rules from Functions trigger configuration:

| Trigger | KEDA Scaler | Notes |
|---------|-------------|-------|
| HTTP | `http` | Built-in HTTP scaling |
| Timer | `cron` | Cron-based scheduling |
| Service Bus | `azure-servicebus` | Queue/topic scaling |
| Event Hubs | `azure-eventhub` | Partition-based scaling |
| Cosmos DB | `azure-cosmosdb` | Change feed scaling |
| Blob Storage | Event Grid | Autoscaling requires an Event Grid source |
| Storage Queue | `azure-queue` | Queue length scaling |

Redis and Azure SQL triggers do not support autoscaling. Set `minReplicas` above zero for
unsupported triggers. Durable Functions autoscaling supports SQL Server and Durable Task
Scheduler storage providers.

Only set custom rules after opting out with `allowScalingRuleOverride`. Default deployments
should let the Functions platform derive rules from trigger attributes and `host.json`.

## Key Differences from Standard Functions

1. **You manage the Dockerfile** — base image must be `mcr.microsoft.com/azure-functions/<runtime>`
2. **Scaling is KEDA-based** — platform-generated rules are the default
3. **Storage is still required** — Functions runtime needs `AzureWebJobsStorage`
4. **No Flex Consumption billing** — billed as Container Apps

> ⚠️ **Always use the official Functions base images** from MCR.
> Custom base images may break the Functions runtime.
>
> **Source:** [Azure Functions on Azure Container Apps](https://learn.microsoft.com/azure/container-apps/functions-overview)
