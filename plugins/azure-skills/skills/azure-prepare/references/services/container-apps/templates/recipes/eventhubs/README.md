# Event Hubs Recipe

Use Event Hubs for high-throughput event streams. Consumers should use a dedicated consumer
group, Blob Storage checkpoints, managed identity, and KEDA scaling.

## Infrastructure

```bicep
param name string
param location string = resourceGroup().location
param appPrincipalId string
param userAssignedIdentityId string

var receiverRoleId = 'a638d3c7-ab3a-418d-83e6-5f17a39d4fde'
var blobContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource ns 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: name
  location: location
  sku: { name: 'Standard', tier: 'Standard', capacity: 1 }
  properties: { disableLocalAuth: true }
}
resource hub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: ns
  name: 'events'
  properties: { partitionCount: 4, messageRetentionInDays: 1 }
}
resource group 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: hub
  name: 'workers'
}

resource checkpointStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('${uniqueString(resourceGroup().id, name)}checkpoints', 24)
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: checkpointStorage
  name: 'default'
}
resource checkpointContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'checkpoints'
  properties: { publicAccess: 'None' }
}

resource eventHubReceiver 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(ns.id, appPrincipalId, receiverRoleId)
  scope: ns
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', receiverRoleId)
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
  }
}
resource checkpointWriter 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(checkpointStorage.id, appPrincipalId, blobContributorRoleId)
  scope: checkpointStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobContributorRoleId)
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output eventHubFqdn string = '${ns.name}.servicebus.windows.net'
output eventHubName string = hub.name
output consumerGroup string = group.name
output checkpointStorageUrl string = 'https://${checkpointStorage.name}.blob.${environment().suffixes.storage}'
```

## KEDA Rule

```bicep
custom: {
  type: 'azure-eventhub'
  metadata: {
    eventHubNamespace: ns.name
    eventHubName: hub.name
    consumerGroup: group.name
    storageAccountName: checkpointStorage.name
    blobContainer: checkpointContainer.name
    checkpointStrategy: 'blobMetadata'
    unprocessedEventThreshold: '64'
  }
  identity: userAssignedIdentityId
}
```

Set the four endpoint/name outputs as `EVENTHUB_FQDN`, `EVENTHUB_NAME`,
`EVENTHUB_CONSUMER_GROUP`, and `CHECKPOINT_STORAGE_URL`; also set `AZURE_CLIENT_ID`.

## Language Guides

| Language | Guide |
|---|---|
| C# | [source/dotnet.md](source/dotnet.md) |
| Python | [source/python.md](source/python.md) |
| Node.js/TypeScript | [source/nodejs.md](source/nodejs.md) |
| Go | [source/go.md](source/go.md) |
| Java | [source/java.md](source/java.md) |

See [eval/summary.md](eval/summary.md) for static coverage.

**Sources:** [Event Hubs managed identity](https://learn.microsoft.com/azure/event-hubs/authenticate-managed-identity),
[Container Apps scale rules](https://learn.microsoft.com/azure/container-apps/scale-app)
