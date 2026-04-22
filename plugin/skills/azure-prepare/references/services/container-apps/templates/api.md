# API Template — REFERENCE ONLY

REST and gRPC API services on Azure Container Apps with ingress configuration.

## When to Use

- REST API with OpenAPI/Swagger
- gRPC service
- API gateway backend
- Backend-for-frontend (BFF) pattern

## Project Structure

```
project-root/
├── azure.yaml
├── Dockerfile
├── src/
│   └── (API code)
└── infra/
    ├── main.bicep
    └── app/
        └── api.bicep
```

## azure.yaml

```yaml
name: my-api
metadata:
  template: container-apps-api
services:
  api:
    host: containerapp
    project: .
    language: <js|ts|python|csharp|java|go>
```

## Bicep — API Container App

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param envId string
param containerRegistryName string
param imageName string
param userAssignedIdentityId string
param isGrpc bool = false

resource api 'Microsoft.App/containerApps@2024-03-01' = {
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
        targetPort: 8080
        transport: isGrpc ? 'http2' : 'auto'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
        }
        // ⚠️ Replace '*' with specific origins for production
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
          name: 'api'
          image: imageName
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'PORT', value: '8080' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 20
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}

output fqdn string = api.properties.configuration.ingress.fqdn
output name string = api.name
```

## REST vs gRPC

| Setting | REST | gRPC |
|---------|------|------|
| `transport` | `auto` | `http2` |
| `targetPort` | 8080 | 8080 |
| Ingress | External or internal | External or internal |

> ⚠️ **gRPC requires `transport: 'http2'`** — without it, gRPC calls fail.

## Internal API (No External Ingress)

For backend APIs only consumed by other Container Apps:

```bicep
ingress: {
  external: false        // internal only
  targetPort: 8080
  transport: 'auto'
}
```

Internal APIs are reachable at `https://<app-name>.internal.<env-domain>`.

## API with Authentication

Use Easy Auth or integrate with Microsoft Entra ID:

```bicep
configuration: {
  ingress: {
    external: true
    targetPort: 8080
  }
}
```

> 💡 **Tip:** For API authentication, consider using the built-in authentication
> feature of Container Apps (Easy Auth) or validating JWT tokens in your application code.

## CORS Configuration

Restrict `allowedOrigins` for production:

```bicep
corsPolicy: {
  allowedOrigins: ['https://myapp.example.com']
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE']
  allowedHeaders: ['Authorization', 'Content-Type']
  maxAge: 3600
}
```
