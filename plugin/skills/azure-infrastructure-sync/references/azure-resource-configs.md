# Azure Resource Configuration Reference

Per-resource-type property retrieval mapping and auto-detection rules used by infrastructure-sync workflows for drift comparison and selective remediation planning.

For per-resource defaults (SKUs, sizes, settings), derive from Bicep MCP `get_az_resource_type_schema`, Azure Verified Modules, or Microsoft documentation. Do not hardcode defaults — verify at comparison time; if deployment validation is needed, defer to `azure-validate`.

---

## Global Extraction Rules

### SKU Extraction

For all resource types with `skuName` / `skuTier` properties, extract from the top-level `sku` object:
- `sku.name` → `skuName`
- `sku.tier` → `skuTier`

### Composite Property Rules

| Resource Type | Property | Assembled From |
|---------------|----------|----------------|
| `Microsoft.Compute/virtualMachines` | `osImage` | `properties.storageProfile.imageReference.publisher` + `:` + `offer` + `:` + `sku` + `:` + `version` |

## Resource Type Sub-References

For additional resource types, see:
- **Compute & Containers**: [azure-resource-configs-compute.md](azure-resource-configs-compute.md) — VM, VMSS, AKS, Container Apps, ACR, AppInsights, Log Analytics
- **Network**: [azure-resource-configs-network.md](azure-resource-configs-network.md) — VNet, Subnet, NSG, Load Balancer, App Gateway, Public IP, NIC, Private Endpoint, VPN Gateway, Firewall, Bastion, Private DNS

---

## Azure Property Retrieval Mapping

Each resource type section includes:
- **MCP Tool**: Primary Azure MCP tool to query (if available)
- **Fallback**: CLI command for types without a dedicated MCP tool
- **Field Paths**: JSON paths in the ARM response

### Microsoft.Web/serverfarms

**MCP Tool**: `mcp_azure_appservice`
**Fallback**: `az appservice plan show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| skuTier | `sku.tier` | |
| kind | `kind` | Top-level field |
| reserved | `properties.reserved` | |
| capacity | `sku.capacity` | |

### Microsoft.Web/sites

**MCP Tool**: `mcp_azure_appservice`
**Fallback**: `az webapp show --ids <resourceId> -o json` + `az webapp config show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| runtimeStack | `properties.siteConfig.linuxFxVersion` or `properties.siteConfig.windowsFxVersion` | Format: `RUNTIME\|VERSION` |
| httpsOnly | `properties.httpsOnly` | |
| minTlsVersion | `properties.siteConfig.minTlsVersion` | Requires config sub-call |
| alwaysOn | `properties.siteConfig.alwaysOn` | Requires config sub-call |
| http20Enabled | `properties.siteConfig.http20Enabled` | Requires config sub-call |
| ftpsState | `properties.siteConfig.ftpsState` | Requires config sub-call |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
| vnetIntegrationSubnet | `properties.virtualNetworkSubnetId` | |

### Microsoft.Web/sites/functions

**MCP Tool**: `mcp_azure_appservice`
**Fallback**: `az functionapp show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| runtimeStack | `properties.siteConfig.linuxFxVersion` | |
| hostingPlan | *(derived from linked serverfarm SKU)* | |
| httpsOnly | `properties.httpsOnly` | |
| minTlsVersion | `properties.siteConfig.minTlsVersion` | |

### Microsoft.Storage/storageAccounts

**MCP Tool**: `mcp_azure_storage`
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

**MCP Tool**: `mcp_azure_sql`
**Fallback**: `az sql server show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| administratorLogin | `properties.administratorLogin` | |
| minimalTlsVersion | `properties.minimalTlsVersion` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |

### Microsoft.Sql/servers/databases

**MCP Tool**: `mcp_azure_sql`
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

**MCP Tool**: `mcp_azure_cosmos`
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

**MCP Tool**: `mcp_azure_redis`
**Fallback**: `az redis show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | Nested under `properties.sku` |
| capacity | `properties.sku.capacity` | Nested under `properties.sku` |
| enableNonSslPort | `properties.enableNonSslPort` | |
| minimumTlsVersion | `properties.minimumTlsVersion` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |

### Microsoft.KeyVault/vaults

**MCP Tool**: `mcp_azure_keyvault`
**Fallback**: `az keyvault show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | Nested under `properties.sku` |
| enableRbacAuthorization | `properties.enableRbacAuthorization` | |
| enableSoftDelete | `properties.enableSoftDelete` | |
| softDeleteRetentionInDays | `properties.softDeleteRetentionInDays` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
| enablePurgeProtection | `properties.enablePurgeProtection` | |

### Microsoft.ServiceBus/namespaces

**MCP Tool**: `mcp_azure_servicebus`
**Fallback**: `az servicebus namespace show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| capacity | `sku.capacity` | |
| zoneRedundant | `properties.zoneRedundant` | |

### Microsoft.EventHub/namespaces

**MCP Tool**: `mcp_azure_eventhubs`
**Fallback**: `az eventhubs namespace show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| capacity | `sku.capacity` | |
| isAutoInflateEnabled | `properties.isAutoInflateEnabled` | |

### Microsoft.ApiManagement/service

**MCP Tool**: *(none — use fallback)*
**Fallback**: `az apim show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| capacity | `sku.capacity` | |
| publisherEmail | `properties.publisherEmail` | |
| publisherName | `properties.publisherName` | |

## Auto-Detection Rules

See [azure-auto-detection-rules.md](azure-auto-detection-rules.md) for topology-based settings automatically applied during drift detection and remediation planning.
