# Redis Recipe — REFERENCE ONLY

Azure Managed Redis (or Azure Cache for Redis) integration for Container Apps.

## When to Use

- Application caching (session, output, data)
- Distributed state store
- Rate limiting
- Dapr state store backend

## Bicep — Redis Module

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param principalId string

resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'aad-enabled': 'true'
    }
  }
}

// RBAC — Redis Cache Contributor
resource rbac 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(redis.id, principalId, 'e0f68234-74aa-48ed-b826-c38b57376e17')
  scope: redis
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'e0f68234-74aa-48ed-b826-c38b57376e17'
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output hostName string = redis.properties.hostName
output sslPort int = redis.properties.sslPort
```

## Environment Variables

```bicep
env: [
  { name: 'REDIS_HOSTNAME', value: redis.outputs.hostName }
  { name: 'REDIS_PORT', value: string(redis.outputs.sslPort) }
  { name: 'AZURE_CLIENT_ID', value: uami.outputs.clientId }
]
```

## RBAC Roles

| Role | GUID | Access |
|------|------|--------|
| Redis Cache Contributor | `e0f68234-74aa-48ed-b826-c38b57376e17` | Manage cache + data |
| Redis Cache Data Access | Custom role | Data plane operations |

## SDK Connection (Node.js Example)

```javascript
const { createClient } = require("redis");
const { DefaultAzureCredential } = require("@azure/identity");

const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});

const client = createClient({
  url: `rediss://${process.env.REDIS_HOSTNAME}:${process.env.REDIS_PORT}`,
  credential,
});
```

## Dapr State Store

Redis can also be used as a Dapr state store component:

```bicep
resource stateStore 'Microsoft.App/managedEnvironments/daprComponents@2024-03-01' = {
  parent: env
  name: 'statestore'
  properties: {
    componentType: 'state.redis'
    version: 'v1'
    metadata: [
      { name: 'redisHost', value: '${redis.outputs.hostName}:${redis.outputs.sslPort}' }
      { name: 'enableTLS', value: 'true' }
      { name: 'azureClientId', value: uamiClientId }
    ]
  }
}
```

> ⚠️ **Always enable Entra ID authentication** via `aad-enabled: true`
> and disable non-SSL port.
