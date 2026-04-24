# Microservice Template — REFERENCE ONLY

Multi-service architecture on Azure Container Apps with service discovery.

## When to Use

- Multiple independent services communicating via HTTP/gRPC
- Mono-repo or multi-repo microservice architecture
- Services with independent scaling requirements
- Dapr-enabled service mesh

## Project Structure

```
project-root/
├── azure.yaml
├── src/
│   ├── frontend/
│   │   └── Dockerfile
│   ├── api-gateway/
│   │   └── Dockerfile
│   └── worker-service/
│       └── Dockerfile
└── infra/
    ├── main.bicep
    └── app/
        ├── frontend.bicep
        ├── api-gateway.bicep
        └── worker-service.bicep
```

## azure.yaml

```yaml
name: my-microservices
metadata:
  template: container-apps-microservices
services:
  frontend:
    host: containerapp
    project: ./src/frontend
  api-gateway:
    host: containerapp
    project: ./src/api-gateway
  worker-service:
    host: containerapp
    project: ./src/worker-service
```

## Bicep — Multi-Service Environment

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param logAnalyticsWorkspaceId string
param logAnalyticsSharedKey string

// logAnalytics resource must be declared or passed as parameter
// Shared Container Apps Environment
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspaceId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
}
```

## Service Discovery

Container Apps in the same environment discover each other by name:

```
https://<app-name>.internal.<default-domain>
```

### Internal Communication Pattern

```bicep
// Frontend (external ingress)
ingress: {
  external: true
  targetPort: 3000
}

// API Gateway (internal ingress)
ingress: {
  external: false
  targetPort: 8080
}

// Worker (no ingress — processes messages only)
// Omit ingress block entirely
```

### Environment Variables for Service URLs

Pass internal URLs via environment variables:

```bicep
env: [
  {
    name: 'API_GATEWAY_URL'
    value: 'https://${apiGateway.properties.configuration.ingress.fqdn}'
  }
]
```

## Scaling Per Service

Each service scales independently:

| Service | Min | Max | Scale Rule |
|---------|-----|-----|------------|
| Frontend | 1 | 10 | HTTP concurrency |
| API Gateway | 2 | 20 | HTTP concurrency |
| Worker | 0 | 30 | Queue depth (KEDA) |

## With Dapr

For microservices using Dapr, apply the [Dapr recipe](recipes/dapr/README.md) to enable:
- Service-to-service invocation
- State management
- Pub/sub messaging
- Distributed tracing

```bicep
configuration: {
  dapr: {
    enabled: true
    appId: 'api-gateway'
    appPort: 8080
    appProtocol: 'http'
  }
}
```

## Deployment Order

Deploy services with dependencies in correct order:

```bash
azd provision --no-prompt
sleep 60  # RBAC propagation
azd deploy --no-prompt
```

> 💡 **Tip:** `azd deploy` deploys all services defined in `azure.yaml`.
> Individual services: `azd deploy --service api-gateway`.
