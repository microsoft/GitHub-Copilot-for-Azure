# Azure Cosmos DB

Data patterns and best practices for Azure Cosmos DB.

## When to Use

- Global distribution requirements
- Multi-model data (document, graph, key-value)
- Variable and unpredictable throughput
- Low-latency reads/writes at scale
- Flexible schema requirements

## Bicep Resource Pattern

```bicep
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${resourcePrefix}-cosmos-${uniqueHash}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      {
        name: 'EnableServerless'  // For serverless tier
      }
    ]
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: 'appdb'
  properties: {
    resource: {
      id: 'appdb'
    }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDatabase
  name: 'items'
  properties: {
    resource: {
      id: 'items'
      partitionKey: {
        paths: ['/partitionKey']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Cosmos DB is fully managed |
| Key Vault | Store connection strings |

## Capacity Modes

| Mode | Use Case | Billing |
|------|----------|---------|
| **Serverless** | Variable/low traffic, dev/test | Per request |
| **Provisioned** | Predictable workloads | Per RU/s |
| **Autoscale** | Variable but predictable peaks | Per max RU/s |

### Serverless

```bicep
capabilities: [
  { name: 'EnableServerless' }
]
```

### Autoscale

```bicep
resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  properties: {
    resource: { ... }
    options: {
      autoscaleSettings: {
        maxThroughput: 4000
      }
    }
  }
}
```

## Consistency Levels

| Level | Latency | Consistency |
|-------|---------|-------------|
| Strong | Highest | Linearizable |
| Bounded Staleness | High | Bounded |
| Session | Medium | Session-scoped |
| Consistent Prefix | Low | Prefix ordering |
| Eventual | Lowest | Eventually consistent |

Recommendation: Use **Session** for most applications.

## Partition Key Selection

**Good partition keys:**
- High cardinality (many distinct values)
- Even distribution of data
- Even distribution of requests
- Used in most queries

**Examples:**
- `/userId` for user-centric data
- `/tenantId` for multi-tenant apps
- `/category` + `/id` for hierarchical data

## Connection Patterns

### Node.js

```javascript
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database("appdb");
const container = database.container("items");
```

### Python

```python
from azure.cosmos import CosmosClient

client = CosmosClient.from_connection_string(os.environ["COSMOS_CONNECTION_STRING"])
database = client.get_database_client("appdb")
container = database.get_container_client("items")
```

### .NET

```csharp
var client = new CosmosClient(Environment.GetEnvironmentVariable("COSMOS_CONNECTION_STRING"));
var database = client.GetDatabase("appdb");
var container = database.GetContainer("items");
```

## Environment Variables

| Variable | Value |
|----------|-------|
| `COSMOS_CONNECTION_STRING` | Primary connection string (Key Vault reference) |
| `COSMOS_ENDPOINT` | Account endpoint URL |
| `COSMOS_DATABASE` | Database name |

## Global Distribution

```bicep
properties: {
  locations: [
    {
      locationName: 'East US'
      failoverPriority: 0
    }
    {
      locationName: 'West US'
      failoverPriority: 1
    }
  ]
  enableMultipleWriteLocations: true
}
```
