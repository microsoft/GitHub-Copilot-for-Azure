# Azure Container Apps

Hosting patterns and best practices for Azure Container Apps.

## When to Use

- Microservices and APIs
- Background processing workers
- Event-driven applications
- Web applications (server-rendered)
- Any containerized workload that doesn't need full Kubernetes

> ⚠️ **Security**: Always use `secretRef` for sensitive environment variables.
> See [Environment Variables and Secrets](#environment-variables-and-secrets).

## Service Type in azure.yaml

```yaml
services:
  my-api:
    host: containerapp
    project: ./src/my-api
    docker:
      path: ./Dockerfile
```

## Bicep Resource Pattern

```bicep
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  properties: {
    environmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
    }
    template: {
      containers: [
        {
          name: serviceName
          image: '${containerRegistry.properties.loginServer}/${serviceName}:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsights.properties.ConnectionString
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| Container Apps Environment | Hosting environment |
| Container Registry | Image storage |
| Log Analytics Workspace | Logging |
| Application Insights | Monitoring |

## Scaling Patterns

### HTTP-based Scaling

```bicep
scale: {
  minReplicas: 1
  maxReplicas: 10
  rules: [
    {
      name: 'http-scaling'
      http: {
        metadata: {
          concurrentRequests: '100'
        }
      }
    }
  ]
}
```

### Queue-based Scaling

```bicep
scale: {
  minReplicas: 0
  maxReplicas: 30
  rules: [
    {
      name: 'queue-scaling'
      azureQueue: {
        queueName: 'orders'
        queueLength: 10
        auth: [
          {
            secretRef: 'storage-connection'
            triggerParameter: 'connection'
          }
        ]
      }
    }
  ]
}
```

## Environment Variables and Secrets

> ⛔ **NEVER** use `env[].value` for passwords, connection strings, API keys, or other sensitive data.
> Secrets in `env[].value` are stored as plain text in the Container App configuration and are visible in Azure Portal and ARM/CLI exports.

### Pattern 1: secretRef (Required for Sensitive Data)

Define secrets in the `configuration.secrets` array, then reference them:

```bicep
configuration: {
  secrets: [
    {
      name: 'database-url'
      value: databaseConnectionString  // Stored securely by Container Apps
    }
  ]
}
// Then in container env:
env: [
  {
    name: 'DATABASE_URL'
    secretRef: 'database-url'  // ✅ Secure - references secret by name
  }
]
```

### Pattern 2: Key Vault Integration (Recommended)

For production, pull secrets directly from Key Vault:

```bicep
identity: {
  type: 'SystemAssigned'
}
// ...
configuration: {
  secrets: [
    {
      name: 'database-url'
      keyVaultUrl: 'https://my-vault.vault.azure.net/secrets/database-url'
      identity: 'system'
    }
  ]
}
// Then in container env:
env: [
  {
    name: 'DATABASE_URL'
    secretRef: 'database-url'
  }
]
```

> **Note**: The managed identity must have `Key Vault Secrets User` role on the Key Vault.

### Pattern 3: Direct Value (Non-Sensitive Only)

Use `value` only for non-sensitive configuration:

```bicep
env: [
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: applicationInsights.properties.ConnectionString  // ✅ OK - not a secret
  }
  {
    name: 'LOG_LEVEL'
    value: 'info'  // ✅ OK - not sensitive
  }
]
```

### What Requires secretRef?

| Data Type | Use secretRef? |
|-----------|---------------|
| Database connection strings | ✅ Yes |
| API keys | ✅ Yes |
| Passwords | ✅ Yes |
| Storage account keys | ✅ Yes |
| App Insights connection string | ❌ No (not a secret) |
| Feature flags | ❌ No |
| Log levels | ❌ No |

## Health Probes

Always configure health probes:

```bicep
probes: [
  {
    type: 'liveness'
    httpGet: {
      path: '/health'
      port: 8080
    }
    initialDelaySeconds: 10
    periodSeconds: 30
  }
  {
    type: 'readiness'
    httpGet: {
      path: '/ready'
      port: 8080
    }
    initialDelaySeconds: 5
    periodSeconds: 10
  }
]
```

## Common Configurations

### API Service

- External ingress: `true`
- Min replicas: `1` (avoid cold starts)
- HTTP scaling with concurrent requests

### Background Worker

- External ingress: `false`
- Min replicas: `0` (scale to zero)
- Queue-based or event-based scaling

### Web Application

- External ingress: `true`
- Custom domain and TLS
- Session affinity if needed
