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
      name: 'Standard'
      family: 'C'
      capacity: 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'aad-enabled': 'true'
    }
  }
}

// Data access — Redis uses its own access policy system, not ARM roleAssignments
resource accessPolicy 'Microsoft.Cache/redis/accessPolicyAssignments@2024-03-01' = {
  parent: redis
  name: guid(redis.id, principalId, 'data-owner')
  properties: {
    accessPolicyName: 'Data Owner'
    objectId: principalId
    objectIdAlias: 'appIdentity'
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
  { name: 'REDIS_USER_OID', value: uami.outputs.principalId }  // objectId for Redis username
]
```

## Access Policies

Redis uses its own data access policy system (not ARM roleAssignments):

| Policy | Access |
|--------|--------|
| Data Owner | Read + write data, manage access policies |
| Data Contributor | Read + write data |
| Data Reader | Read-only data |

> ⚠️ **Do not use ARM `roleAssignments`** for Redis data access — those are control-plane only. Use `Microsoft.Cache/redis/accessPolicyAssignments` as shown above.

## SDK Connection (Node.js Example)

```javascript
const { createClient } = require("redis");
const { DefaultAzureCredential } = require("@azure/identity");

const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});

async function createRedisClient() {
  const { token } = await credential.getToken("https://redis.azure.com/.default");
  const client = createClient({
    url: `rediss://${process.env.REDIS_HOSTNAME}:${process.env.REDIS_PORT}`,
    username: process.env.REDIS_USER_OID,  // objectId (principalId), not clientId
    password: token,
  });
  await client.connect();
  return client;
}
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
      { name: 'useEntraID', value: 'true' }
    ]
  }
}
```

> ⚠️ **Always enable Entra ID authentication** via `aad-enabled: true`
> and disable non-SSL port.
