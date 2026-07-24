# Dapr Integration Recipe — REFERENCE ONLY

Dapr (Distributed Application Runtime) integration for Container Apps
providing service invocation, state management, and pub/sub messaging.

## When to Use

- Service-to-service communication (HTTP/gRPC invocation)
- Distributed state management
- Pub/sub messaging between microservices
- Distributed tracing across services

## Capabilities

| Component | Description | Use Case |
|-----------|-------------|----------|
| Service Invocation | Call other services by app ID | Microservice communication |
| State Store | Key/value state management | Session state, caches |
| Pub/Sub | Publish and subscribe to topics | Event-driven messaging |
| Bindings | Input/output bindings to external systems | Trigger from / push to services |

## Bicep — Enable Dapr on Container App

```bicep
configuration: {
  dapr: {
    enabled: true
    appId: 'my-service'
    appPort: 8080
    appProtocol: 'http'  // or 'grpc'
  }
}
```

## Bicep — Dapr State Store Component (Cosmos DB)

```bicep
resource stateStore 'Microsoft.App/managedEnvironments/daprComponents@2024-03-01' = {
  parent: env
  name: 'statestore'
  properties: {
    componentType: 'state.azure.cosmosdb'
    version: 'v1'
    metadata: [
      { name: 'url', value: cosmosEndpoint }
      { name: 'database', value: 'daprdb' }
      { name: 'collection', value: 'state' }
      { name: 'azureClientId', value: uamiClientId }
    ]
    scopes: ['my-service']
  }
}
```

## Bicep — Dapr Pub/Sub Component (Service Bus)

```bicep
resource pubsub 'Microsoft.App/managedEnvironments/daprComponents@2024-03-01' = {
  parent: env
  name: 'pubsub'
  properties: {
    componentType: 'pubsub.azure.servicebus.topics'
    version: 'v1'
    metadata: [
      {
        name: 'namespaceName'
        value: '${serviceBusNamespace}.servicebus.windows.net'
      }
      { name: 'azureClientId', value: uamiClientId }
    ]
    scopes: ['publisher-service', 'subscriber-service']
  }
}
```

## Service Invocation Example

```python
# Call another service via Dapr sidecar
import requests

DAPR_PORT = 3500
response = requests.get(
    f"http://localhost:{DAPR_PORT}/v1.0/invoke/order-service/method/orders"
)
```

## Required RBAC Roles

| Service | Role | GUID |
|---------|------|------|
| Cosmos DB (state) | Cosmos DB Built-in Data Contributor | `00000000-0000-0000-0000-000000000002` |
| Service Bus (pub/sub) | Azure Service Bus Data Owner | `090c5cfd-751d-490a-894a-3ce6f1109419` |

## Environment Variables

No additional env vars needed — Dapr sidecar handles connections via component metadata.

> 💡 **Tip:** Scope Dapr components to specific app IDs using `scopes` to enforce
> least-privilege access between services.
