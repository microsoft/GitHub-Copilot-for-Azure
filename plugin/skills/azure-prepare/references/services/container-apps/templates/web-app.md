# Web App Template — REFERENCE ONLY

High-scale serverless web app on Azure Container Apps.
Supports any language/framework: Node.js, Python, .NET, Java, Go, Rust, etc.

## When to Use

- General-purpose web application with HTTP ingress
- Frontend + backend in a single container
- Any framework: Express, FastAPI, ASP.NET, Spring Boot, Gin, etc.

## Project Structure

```
project-root/
├── azure.yaml
├── Dockerfile
├── src/
│   └── (application code)
└── infra/
    ├── main.bicep          # or *.tf
    ├── main.parameters.json
    └── app/
        └── container-app.bicep
```

## azure.yaml

```yaml
name: my-web-app
metadata:
  template: container-apps-web-app
services:
  web:
    host: containerapp
    project: .
    language: <js|ts|python|csharp|java|go>
```

## Bicep — Container App Module

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param containerRegistryName string
param imageName string
param envId string
param userAssignedIdentityId string

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    managedEnvironmentId: envId
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
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
          name: 'main'
          image: imageName
          resources: { cpu: json('0.5'), memory: '1Gi' }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '100' } }
          }
        ]
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output name string = app.name
output principalId string = app.identity.userAssignedIdentities[userAssignedIdentityId].principalId
```

## Deployment

```bash
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init -e "$ENV_NAME" --no-prompt
azd env set AZURE_LOCATION eastus2
azd up --no-prompt
```

## Scaling

| Rule | Trigger | Default |
|------|---------|---------|
| HTTP | Concurrent requests | 100 per instance |
| Min replicas | Scale to zero | 0 |
| Max replicas | Burst limit | 10 |

## Language-Specific `targetPort`

| Framework | Default Port |
|-----------|-------------|
| Node.js (Express) | 3000 |
| Python (FastAPI/Gunicorn) | 8000 |
| .NET (Kestrel) | 8080 |
| Java (Spring Boot) | 8080 |
| Go (net/http) | 8080 |

> ⚠️ **Set `targetPort` to match your app's listen port.** Mismatched ports cause 502 errors.

## Health Probes

Always configure liveness and readiness probes. See [health-probes.md](../health-probes.md).

```bicep
probes: [
  {
    type: 'liveness'
    httpGet: { path: '/healthz', port: 3000 }
    periodSeconds: 10
  }
  {
    type: 'readiness'
    httpGet: { path: '/ready', port: 3000 }
    periodSeconds: 5
  }
]
```
