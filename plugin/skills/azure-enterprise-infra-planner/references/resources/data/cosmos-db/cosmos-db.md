# Cosmos DB

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.DocumentDB/databaseAccounts` |
| Bicep API Version | `2025-04-15` |
| CAF Prefix | `cosmos` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

These are the exact `kind` values accepted in Bicep:

| Kind | Description |
|------|-------------|
| `GlobalDocumentDB` | SQL (NoSQL) API — **default** |
| `MongoDB` | MongoDB API |
| `Parse` | Parse-compatible (legacy) |

> **Note:** Cassandra, Table, and Gremlin APIs are selected via `properties.capabilities`, not `kind`. See Key Properties.

## SKU Names

Cosmos DB does not use a `sku` block. Throughput is configured via `databaseAccountOfferType` and individual database/container settings.

| Property | Value | Description |
|----------|-------|-------------|
| `properties.databaseAccountOfferType` | `Standard` | **Only accepted value** — required |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 44 |
| Allowed Characters | Lowercase letters, numbers, and hyphens. Must start/end with letter or number. No consecutive hyphens. |
| Scope | Global (must be globally unique as DNS name) |
| Pattern | `cosmos-{workload}-{env}-{instance}` |
| Example | `cosmos-datapipeline-prod-001` |
| Regex | `^[a-z0-9]+(-[a-z0-9]+)*$` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.consistencyPolicy.defaultConsistencyLevel` | Default consistency | `Eventual`, `Session`, `BoundedStaleness`, `Strong`, `ConsistentPrefix` |
| `properties.enableMultipleWriteLocations` | Multi-region writes | `true`, `false` |
| `properties.enableAutomaticFailover` | Auto failover | `true`, `false` |
| `properties.enableFreeTier` | Free tier (1 per subscription) | `true`, `false` |
| `properties.createMode` | Account creation mode | `Default`, `Restore` |
| `properties.capabilities[].name` | API capabilities | `EnableCassandra`, `EnableTable`, `EnableGremlin`, `EnableServerless`, `EnableMongo` |
| `properties.isVirtualNetworkFilterEnabled` | VNet filtering | `true`, `false` |
| `properties.publicNetworkAccess` | Public access | `Disabled`, `Enabled`, `SecuredByPerimeter` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| SQL Databases | `Microsoft.DocumentDB/databaseAccounts/sqlDatabases` | NoSQL API databases |
| SQL Containers | `Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers` | NoSQL API containers |
| MongoDB Databases | `Microsoft.DocumentDB/databaseAccounts/mongodbDatabases` | MongoDB API databases |
| MongoDB Collections | `Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections` | MongoDB API collections |
| Cassandra Keyspaces | `Microsoft.DocumentDB/databaseAccounts/cassandraKeyspaces` | Cassandra API keyspaces |
| Gremlin Databases | `Microsoft.DocumentDB/databaseAccounts/gremlinDatabases` | Gremlin API graph databases |
| Table Resources | `Microsoft.DocumentDB/databaseAccounts/tables` | Table API tables |

## References

- [Bicep resource reference (2025-04-15)](https://learn.microsoft.com/azure/templates/microsoft.documentdb/databaseaccounts?pivots=deployment-language-bicep)
- [Cosmos DB overview](https://learn.microsoft.com/azure/cosmos-db/introduction)
- [Azure naming rules — Cosmos DB](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdocumentdb)
- [Consistency levels](https://learn.microsoft.com/azure/cosmos-db/consistency-levels)
