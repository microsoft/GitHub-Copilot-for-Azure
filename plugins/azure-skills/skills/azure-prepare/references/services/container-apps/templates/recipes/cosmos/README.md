# Cosmos DB Recipe — REFERENCE ONLY

Azure Cosmos DB integration for Container Apps.

## When to Use

- NoSQL document database
- Global distribution requirements
- Low-latency reads/writes
- Change feed processing

## Bicep — Cosmos DB Module

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param principalId string

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: name
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    disableLocalAuth: true
    locations: [
      { locationName: location, failoverPriority: 0 }
    ]
    capabilities: [
      { name: 'EnableServerless' }
    ]
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'appdb'
  properties: {
    resource: { id: 'appdb' }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'items'
  properties: {
    resource: {
      id: 'items'
      partitionKey: { paths: ['/partitionKey'], kind: 'Hash' }
    }
  }
}

// RBAC — Cosmos DB Built-in Data Contributor (data-plane, not ARM roleAssignments)
resource cosmosRbac 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmos
  name: guid(cosmos.id, principalId, 'data-contributor')
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: principalId
    scope: cosmos.id
  }
}

output endpoint string = cosmos.properties.documentEndpoint
output databaseName string = database.name
```

## Environment Variables

```bicep
env: [
  { name: 'COSMOS_ENDPOINT', value: cosmos.outputs.endpoint }
  { name: 'COSMOS_DATABASE', value: cosmos.outputs.databaseName }
  { name: 'AZURE_CLIENT_ID', value: uami.outputs.clientId }
]
```

## SDK Connection (Python Example)

```python
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
import os

credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
client = CosmosClient(
    url=os.environ["COSMOS_ENDPOINT"],
    credential=credential,
)
database = client.get_database_client(os.environ["COSMOS_DATABASE"])
```

## Node.js Connection

```javascript
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");

const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  aadCredentials: credential,
});
const database = client.database(process.env.COSMOS_DATABASE);
```

## RBAC Role

| Role | GUID | Access |
|------|------|--------|
| Cosmos DB Built-in Data Contributor | `00000000-0000-0000-0000-000000000002` | Read + write data |
| Cosmos DB Built-in Data Reader | `00000000-0000-0000-0000-000000000001` | Read-only |

> ⚠️ **Use `sqlRoleAssignments`, not ARM `roleAssignments`.** Cosmos DB data-plane RBAC
> requires the resource-specific role assignment type shown above.
> Also set `disableLocalAuth: true` to disable primary/secondary key auth.

## Language Guides

[C#](source/dotnet.md) | [Python](source/python.md) |
[Node.js/TypeScript](source/nodejs.md) | [Go](source/go.md) | [Java](source/java.md)

See [eval/summary.md](eval/summary.md) for static coverage.
