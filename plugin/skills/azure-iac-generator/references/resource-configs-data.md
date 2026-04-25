# Data Resource Property Mapping

Per-resource property retrieval for data and storage resource types.

**Fallback for all**: `az resource show --ids <resourceId> -o json`

---

### Microsoft.Storage/storageAccounts

**MCP Tool**: `mcp_azure_mcp_storage`
**Fallback**: `az storage account show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| kind | `kind` | Top-level field |
| accessTier | `properties.accessTier` | |
| minimumTlsVersion | `properties.minimumTlsVersion` | |
| supportsHttpsTrafficOnly | `properties.supportsHttpsTrafficOnly` | |
| allowBlobPublicAccess | `properties.allowBlobPublicAccess` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
| enableHierarchicalNamespace | `properties.isHnsEnabled` | |

### Microsoft.Sql/servers

**MCP Tool**: `mcp_azure_mcp_sql`
**Fallback**: `az sql server show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| administratorLogin | `properties.administratorLogin` | |
| minimalTlsVersion | `properties.minimalTlsVersion` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |

### Microsoft.Sql/servers/databases

**MCP Tool**: `mcp_azure_mcp_sql`
**Fallback**: `az sql db show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| skuTier | `sku.tier` | |
| maxSizeBytes | `properties.maxSizeBytes` | |
| zoneRedundant | `properties.zoneRedundant` | |
| readScale | `properties.readScale` | |
| backupRedundancy | `properties.requestedBackupStorageRedundancy` | |

### Microsoft.DocumentDB/databaseAccounts

**MCP Tool**: `mcp_azure_mcp_cosmos`
**Fallback**: `az cosmosdb show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| kind | `kind` | Top-level field |
| consistencyLevel | `properties.consistencyPolicy.defaultConsistencyLevel` | |
| capacityMode | `properties.capacityMode` | |
| enableFreeTier | `properties.enableFreeTier` | |
| enableAutomaticFailover | `properties.enableAutomaticFailover` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
| backupPolicy | `properties.backupPolicy.type` | |

### Microsoft.Cache/redis

**MCP Tool**: `mcp_azure_mcp_redis`
**Fallback**: `az redis show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | Nested under `properties.sku` |
| capacity | `properties.sku.capacity` | Nested under `properties.sku` |
| enableNonSslPort | `properties.enableNonSslPort` | |
| minimumTlsVersion | `properties.minimumTlsVersion` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
