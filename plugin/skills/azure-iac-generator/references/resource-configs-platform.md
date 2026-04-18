# Platform Resource Property Mapping

Per-resource property retrieval for platform, security, and integration resource types.

**Fallback for all**: `az resource show --ids <resourceId> -o json`

---

### Microsoft.KeyVault/vaults

**MCP Tool**: `mcp_azure_keyvault`
**Fallback**: `az keyvault show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | |
| enableRbacAuthorization | `properties.enableRbacAuthorization` | |
| enableSoftDelete | `properties.enableSoftDelete` | |
| softDeleteRetentionInDays | `properties.softDeleteRetentionInDays` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
| enablePurgeProtection | `properties.enablePurgeProtection` | |

### Microsoft.Insights/components

**MCP Tool**: `mcp_azure_applicationinsights`
**Fallback**: `az monitor app-insights component show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| applicationType | `properties.Application_Type` | |
| retentionInDays | `properties.RetentionInDays` | |
| ingestionMode | `properties.IngestionMode` | |

### Microsoft.OperationalInsights/workspaces

**MCP Tool**: `mcp_azure_monitor`
**Fallback**: `az monitor log-analytics workspace show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | |
| retentionInDays | `properties.retentionInDays` | |

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

**Fallback**: `az apim show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| capacity | `sku.capacity` | |
| publisherEmail | `properties.publisherEmail` | |
| publisherName | `properties.publisherName` | |
