# Service Bus Recipe — REFERENCE ONLY

Azure Service Bus integration with KEDA scaling for Container Apps.

## When to Use

- Reliable message queuing between services
- Pub/sub with topics and subscriptions
- Worker scaling based on queue depth
- Ordered message processing

## Bicep — Service Bus Module

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param principalId string
param queueName string = 'tasks'

resource sb 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    disableLocalAuth: true
  }
}

resource queue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: sb
  name: queueName
  properties: {
    maxDeliveryCount: 10
    lockDuration: 'PT1M'
    deadLetteringOnMessageExpiration: true
  }
}

// RBAC — Azure Service Bus Data Owner
resource rbac 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sb.id, principalId, '090c5cfd-751d-490a-894a-3ce6f1109419')
  scope: sb
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '090c5cfd-751d-490a-894a-3ce6f1109419'
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output namespace string = sb.name
output fqdn string = '${sb.name}.servicebus.windows.net'
output queueName string = queue.name
```

## Environment Variables

```bicep
env: [
  { name: 'SERVICEBUS_FQDN', value: sb.outputs.fqdn }
  { name: 'SERVICEBUS_QUEUE', value: sb.outputs.queueName }
  { name: 'AZURE_CLIENT_ID', value: uami.outputs.clientId }
]
```

## KEDA Scaling Rule

Scale workers based on queue message count:

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
          namespace: sb.outputs.namespace
          queueName: sb.outputs.queueName
          messageCount: '5'
        }
        identity: userAssignedIdentityId
      }
    }
  ]
}
```

> 💡 **Tip:** Set `identity` to the UAMI resource ID to authenticate the KEDA scaler via managed identity instead of connection strings.

## RBAC Roles

| Role | GUID | Access |
|------|------|--------|
| Azure Service Bus Data Owner | `090c5cfd-751d-490a-894a-3ce6f1109419` | Full access |
| Azure Service Bus Data Sender | `69a216fc-b8fb-44d8-bc22-1f3c2cd27a39` | Send only |
| Azure Service Bus Data Receiver | `4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0` | Receive only |

## SDK Connection (Python Example)

```python
from azure.servicebus import ServiceBusClient
from azure.identity import DefaultAzureCredential
import os

credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
client = ServiceBusClient(
    fully_qualified_namespace=os.environ["SERVICEBUS_FQDN"],
    credential=credential,
)
```

> ⚠️ **Always set `disableLocalAuth: true`** — use RBAC only, never SAS keys.
