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
param storageAccountName string

resource funcApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
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
              value: uamiClientId  // Required for UAMI — runtime defaults to system MI without this
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
}
```

## Supported Triggers

All Functions triggers work on Container Apps:

| Trigger | KEDA Scaler | Notes |
|---------|-------------|-------|
| HTTP | `http` | Built-in HTTP scaling |
| Timer | `cron` | Cron-based scheduling |
| Service Bus | `azure-servicebus` | Queue/topic scaling |
| Event Hubs | `azure-eventhub` | Partition-based scaling |
| Cosmos DB | `azure-cosmosdb` | Change feed scaling |
| Blob Storage | `azure-blob` | Blob count scaling |
| Storage Queue | `azure-queue` | Queue length scaling |

## KEDA Scale Rules for Triggers

```bicep
scale: {
  minReplicas: 0
  maxReplicas: 30
  rules: [
    {
      name: 'servicebus-scale'
      custom: {
        type: 'azure-servicebus'
        metadata: {
          queueName: 'myqueue'
          namespace: 'my-sb-namespace'
          messageCount: '5'
        }
        identity: userAssignedIdentityId
      }
    }
  ]
}
```

## Key Differences from Standard Functions

1. **You manage the Dockerfile** — base image must be `mcr.microsoft.com/azure-functions/<runtime>`
2. **Scaling is KEDA-based** — configure scale rules explicitly
3. **Storage is still required** — Functions runtime needs `AzureWebJobsStorage`
4. **No Flex Consumption billing** — billed as Container Apps

> ⚠️ **Always use the official Functions base images** from MCR.
> Custom base images may break the Functions runtime.
