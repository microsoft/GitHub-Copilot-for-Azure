# Worker Template — REFERENCE ONLY

Background processing and long-running tasks on Azure Container Apps.

## When to Use

- Queue consumer (Service Bus, Storage Queue, Event Hubs)
- Long-running background processing
- No HTTP ingress required
- Event-driven scaling with KEDA

## Project Structure

```
project-root/
├── azure.yaml
├── Dockerfile
├── src/
│   └── (worker code)
└── infra/
    ├── main.bicep
    └── app/
        └── worker.bicep
```

## azure.yaml

```yaml
name: my-worker
metadata:
  template: container-apps-worker
services:
  worker:
    host: containerapp
    project: .
    language: <js|ts|python|csharp|java|go>
```

## Bicep — Worker Container App

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param envId string
param containerRegistryName string
param imageName string
param userAssignedIdentityId string
param uamiClientId string
// Service Bus params — provided by servicebus recipe, omit if not using SB
param serviceBusNamespace string
param queueName string

resource worker 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'worker' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    managedEnvironmentId: envId
    configuration: {
      // No ingress — worker has no HTTP endpoint
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
          name: 'worker'
          image: imageName
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            {
              name: 'SERVICEBUS_NAMESPACE'
              value: '${serviceBusNamespace}.servicebus.windows.net'
            }
            { name: 'QUEUE_NAME', value: queueName }
            {
              name: 'AZURE_CLIENT_ID'
              value: uamiClientId
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 30
        rules: [
          {
            name: 'queue-scale'
            custom: {
              type: 'azure-servicebus'
              metadata: {
                namespace: serviceBusNamespace
                queueName: queueName
                messageCount: '5'
              }
              identity: userAssignedIdentityId
            }
          }
        ]
      }
    }
  }
}

output name string = worker.name
```

## Scaling Patterns

### Service Bus Queue Scaling (KEDA)

```bicep
rules: [
  {
    name: 'queue-scale'
    custom: {
      type: 'azure-servicebus'
      metadata: {
        namespace: '<namespace>'
        queueName: '<queue>'
        messageCount: '5'  // scale up when > 5 messages
      }
    }
  }
]
```

### Event Hubs Scaling (KEDA)

```bicep
rules: [
  {
    name: 'eventhub-scale'
    custom: {
      type: 'azure-eventhub'
      metadata: {
        namespace: '<namespace>'
        eventHubName: '<eventhub>'
        consumerGroup: '$Default'
        unprocessedEventThreshold: '64'
      }
      identity: userAssignedIdentityId
    }
  }
]
```

### Storage Queue Scaling (KEDA)

```bicep
rules: [
  {
    name: 'storage-queue-scale'
    custom: {
      type: 'azure-queue'
      metadata: {
        accountName: '<storage-account>'
        queueName: '<queue>'
        queueLength: '5'
      }
      identity: userAssignedIdentityId
    }
  }
]
```

## Key Differences from Web App

| Aspect | Web App | Worker |
|--------|---------|--------|
| Ingress | External HTTP | None |
| Scale trigger | HTTP concurrency | Queue depth / events |
| Min replicas | 0–1 | 0 (scale to zero) |
| Health probes | HTTP liveness/readiness | TCP or none |

> ⚠️ **Workers with no ingress cannot use HTTP health probes.**
> Use TCP probes or omit probes and rely on container restart policy.
