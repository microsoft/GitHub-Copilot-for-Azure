# Log Analytics Workspace

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.OperationalInsights/workspaces` |
| Bicep API Version | `2025-02-01` |
| CAF Prefix | `log` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

Log Analytics does not use `kind`.

## SKU Names

| SKU Name | Description |
|----------|-------------|
| `PerGB2018` | Pay-as-you-go per GB — **recommended default** |
| `CapacityReservation` | Committed tier with reserved capacity (100+ GB/day) |
| `Free` | Free tier — 500 MB/day limit, 7-day retention |
| `Standalone` | Legacy standalone pricing |
| `PerNode` | Legacy per-node (OMS) pricing |
| `Standard` | Legacy standard pricing |
| `Premium` | Legacy premium pricing |
| `LACluster` | Dedicated cluster pricing |

> **Note:** Use `PerGB2018` for new deployments. Legacy SKUs (`Standalone`, `PerNode`, `Standard`, `Premium`) are not available for new workspaces.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 4 |
| Max Length | 63 |
| Allowed Characters | Alphanumerics and hyphens. Must start with letter or number, end with letter or number. |
| Scope | Resource group |
| Pattern | `log-{workload}-{env}-{instance}` |
| Regex | `^[A-Za-z0-9][A-Za-z0-9-]{2,61}[A-Za-z0-9]$` |
| Example | `log-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.sku.name` | Pricing tier | See SKU Names table |
| `properties.retentionInDays` | Data retention | `30` to `730` (default: `30`; Free: `7`) |
| `properties.sku.capacityReservationLevel` | Reserved GB/day | `100`, `200`, `300`, `400`, `500`, `1000`, `2000`, `5000` |
| `properties.publicNetworkAccessForIngestion` | Public ingestion | `Disabled`, `Enabled` |
| `properties.publicNetworkAccessForQuery` | Public query | `Disabled`, `Enabled` |
| `properties.features.enableDataExport` | Data export | `true`, `false` |
| `properties.workspaceCapping.dailyQuotaGb` | Daily ingestion cap | Decimal (GB) |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Data Sources | `Microsoft.OperationalInsights/workspaces/dataSources` | Data collection config |
| Linked Services | `Microsoft.OperationalInsights/workspaces/linkedServices` | Service links (e.g., automation) |
| Saved Searches | `Microsoft.OperationalInsights/workspaces/savedSearches` | Saved KQL queries |
| Tables | `Microsoft.OperationalInsights/workspaces/tables` | Custom log tables |
| Data Exports | `Microsoft.OperationalInsights/workspaces/dataExports` | Continuous data export rules |

## References

- [Bicep resource reference (2025-02-01)](https://learn.microsoft.com/azure/templates/microsoft.operationalinsights/workspaces?pivots=deployment-language-bicep)
- [Log Analytics overview](https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview)
- [Azure naming rules — OperationalInsights](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftoperationalinsights)
- [Log Analytics pricing](https://learn.microsoft.com/azure/azure-monitor/logs/cost-logs)
