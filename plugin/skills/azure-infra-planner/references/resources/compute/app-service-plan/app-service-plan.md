# App Service Plan

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Web/serverfarms` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `asp` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

The `kind` property is a free-form string:

| Kind | Description |
|------|-------------|
| `linux` | Linux App Service Plan |
| `windows` | Windows App Service Plan (default if omitted) |
| `elastic` | Premium Functions (Elastic Premium) plan |
| `functionapp` | Consumption Functions plan |
| `app` | Windows plan (alternative) |

> **Note:** For Linux plans, also set `properties.reserved: true`.

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 40 |
| Allowed Characters | Alphanumerics and hyphens |
| Scope | Resource group |
| Pattern | `asp-{workload}-{env}-{instance}` |
| Example | `asp-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | SKU name | See SKU Names tables |
| `sku.tier` | SKU tier | Derived from SKU name pattern |
| `sku.capacity` | Instance count | Integer |
| `properties.reserved` | Linux plan flag | `true` for Linux, `false` for Windows |
| `properties.perSiteScaling` | Per-app scaling | `true`, `false` |
| `properties.elasticScaleEnabled` | Elastic scale (Premium Functions) | `true`, `false` |
| `properties.zoneRedundant` | Zone redundancy | `true`, `false` (Premium v3+ only, 3+ instances) |
| `properties.maximumElasticWorkerCount` | Max elastic workers | Integer |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

App Service Plan has no significant Bicep child resources — apps and functions reference the plan via `serverFarmId`.

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.web/serverfarms?pivots=deployment-language-bicep)
- [App Service plan overview](https://learn.microsoft.com/azure/app-service/overview-hosting-plans)
- [Azure naming rules — Web](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb)
- [App Service pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux)
