# Dapr Recipe — REFERENCE ONLY

Dapr (Distributed Application Runtime) sidecar integration for Container Apps —
service invocation, pub/sub, state management, and secrets.

## When to Use

- Multi-service architectures needing service discovery + invocation
- Pub/sub messaging without SDK lock-in
- Portable state management (Redis, Cosmos, etc. behind one API)
- Secrets access without hardcoding Key Vault SDK calls
- Sidecar pattern preferred over embedding cloud SDKs in app code

## Enable Dapr on Container App

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      dapr: {
        enabled: true
        appId: name
        appPort: 8080
        appProtocol: 'http'
      }
    }
  }
}
```

## 1. Service Invocation

Call other Container Apps by `appId` through the Dapr sidecar — no service discovery code needed.

```bash
# From app code, call another Dapr-enabled app named "orders"
curl http://localhost:3500/v1.0/invoke/orders/method/api/create
```

```python
import requests
resp = requests.post(
    "http://localhost:3500/v1.0/invoke/orders/method/api/create",
    json={"item": "widget"},
)
```

No RBAC or IaC needed — Dapr service invocation uses mTLS between sidecars automatically
within the same Managed Environment.

## 2. Pub/Sub

### Component (backed by Service Bus)

```bicep
param daprAppIds array

resource pubsub 'Microsoft.App/managedEnvironments/daprComponents@2024-03-01' = {
  parent: env
  name: 'pubsub'
  properties: {
    componentType: 'pubsub.azure.servicebus.topics'
    version: 'v1'
    metadata: [
      { name: 'namespaceName', value: sbNamespaceFqdn }
      { name: 'azureClientId', value: uamiClientId }
    ]
    scopes: daprAppIds
  }
}
```

### Publish

```bash
curl -X POST http://localhost:3500/v1.0/publish/pubsub/orders \
  -H "Content-Type: application/json" \
  -d '{"orderId": "123"}'
```

### Subscribe (declarative)

```yaml
apiVersion: dapr.io/v2alpha1
kind: Subscription
metadata:
  name: order-sub
spec:
  topic: orders
  routes:
    default: /orders
  pubsubname: pubsub
```

## 3. State Management

### Component (backed by Redis)

```bicep
param daprAppIds array

resource statestore 'Microsoft.App/managedEnvironments/daprComponents@2024-03-01' = {
  parent: env
  name: 'statestore'
  properties: {
    componentType: 'state.redis'
    version: 'v1'
    metadata: [
      { name: 'redisHost', value: '${redisHost}:${redisSslPort}' }
      { name: 'enableTLS', value: 'true' }
      { name: 'azureClientId', value: uamiClientId }
      { name: 'useEntraID', value: 'true' }
    ]
    scopes: daprAppIds
  }
}
```

### Save / Get State

```bash
curl -X POST http://localhost:3500/v1.0/state/statestore \
  -H "Content-Type: application/json" \
  -d '[{"key": "cart-1", "value": {"items": 3}}]'

curl http://localhost:3500/v1.0/state/statestore/cart-1
```

## 4. Secrets

Access Key Vault secrets through the Dapr sidecar without embedding the Key Vault SDK.

### Component (backed by Key Vault, UAMI auth)

```bicep
param daprAppIds array

resource secretstore 'Microsoft.App/managedEnvironments/daprComponents@2024-03-01' = {
  parent: env
  name: 'secretstore'
  properties: {
    componentType: 'secretstores.azure.keyvault'
    version: 'v1'
    metadata: [
      { name: 'vaultName', value: keyVaultName }
      { name: 'azureClientId', value: uamiClientId }
    ]
    scopes: daprAppIds
  }
}

// RBAC — Key Vault Secrets User (UAMI reads secrets via Dapr)
resource kvSecretsRbac 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, uamiPrincipalId, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
    principalId: uamiPrincipalId
    principalType: 'ServicePrincipal'
  }
}
```

### Read a Secret (Python Example)

```python
import requests

resp = requests.get(
    "http://localhost:3500/v1.0/secrets/secretstore/db-password"
)
secret_value = resp.json()["db-password"]
```

### Read a Secret (Node.js Example)

```javascript
const axios = require("axios");

const resp = await axios.get(
  "http://localhost:3500/v1.0/secrets/secretstore/db-password"
);
const secretValue = resp.data["db-password"];
```

> ⚠️ **Grant `Key Vault Secrets User` (not `Secrets Officer`) to the app's UAMI** —
> the Dapr sidecar only needs read access, never write/manage permissions.

## Environment Variables

```bicep
env: [
  { name: 'AZURE_CLIENT_ID', value: uami.outputs.clientId }
]
```

No app-level SDK env vars are required for Dapr-mediated integrations — components
carry the connection metadata, and the sidecar handles authentication via UAMI.

## RBAC Roles Reference

| Recipe Component | Role | GUID |
|---|---|---|
| Pub/sub (Service Bus) | Data Sender + Data Receiver | `69a216fc-b8fb-44d8-bc22-1f3c2cd27a39`, `4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0` |
| State (Redis) | Redis Data Contributor (access policy) | N/A; see [redis recipe](../redis/README.md) |
| Secrets (Key Vault) | Key Vault Secrets User | `4633458b-17de-408a-b874-0445c86b69e6` |

## Critical Rules

1. **Always enable Dapr at the Container App level** (`configuration.dapr.enabled: true`)
2. **Always set `appId` to a stable, unique name** — other services invoke by this ID
3. **Always use UAMI for component authentication** — never embed connection strings in component metadata
4. **Secrets components require `Key Vault Secrets User`, not broader roles**
5. **Set component `scopes`** — list only the Dapr app IDs that require access

**Source:** [Connect to services with Dapr components](https://learn.microsoft.com/azure/container-apps/dapr-component-connect-services)

## Language Guides

[C#](source/dotnet.md) | [Python](source/python.md) |
[Node.js/TypeScript](source/nodejs.md) | [Go](source/go.md) | [Java](source/java.md)

See [eval/summary.md](eval/summary.md) for static coverage.
