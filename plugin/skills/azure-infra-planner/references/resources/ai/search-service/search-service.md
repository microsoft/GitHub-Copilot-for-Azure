# Azure AI Search

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Search/searchServices` |
| Bicep API Version | `2025-05-01` |
| CAF Prefix | `srch` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

## Subtypes (kind)

This resource does **not** use a `kind` property. All search services are the same type.

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 2 |
| Max Length | 60 |
| Allowed Characters | Lowercase letters, numbers, and hyphens only |
| Pattern (regex) | `^(?=.{2,60}$)[a-z0-9][a-z0-9]+(-[a-z0-9]+)*$` |
| Scope | Global (must be globally unique — forms `{name}.search.windows.net`) |
| Example | `srch-products-prod-001` |

> Must start and end with a lowercase letter or number. No consecutive hyphens. No uppercase.

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.replicaCount` | Number of replicas | 1–12 (standard); 1–3 (basic); minimum 2 for read HA, 3 for read/write HA |
| `properties.partitionCount` | Number of partitions | 1, 2, 3, 4, 6, or 12 (must be a factor of 12) |
| `properties.hostingMode` | Hosting mode | `Default`, `HighDensity` (HighDensity only for `standard3` SKU) |
| `properties.semanticSearch` | Semantic search capability | `disabled`, `free`, `standard` |
| `properties.publicNetworkAccess` | Public network access | `Enabled`, `Disabled`, `SecuredByPerimeter` |
| `properties.disableLocalAuth` | Disable API key auth | `true`, `false` |
| `properties.authOptions.aadOrApiKey` | Entra ID + API key auth | Object with `aadAuthFailureMode`: `http401WithBearerChallenge` or `http403` |
| `properties.authOptions.apiKeyOnly` | API key only auth | Object (empty) |
| `properties.computeType` | Compute type | `Default`, `Confidential` |
| `properties.encryptionWithCmk.enforcement` | CMK enforcement | `Disabled`, `Enabled`, `Unspecified` |
| `properties.networkRuleSet.bypass` | Bypass trusted services | `AzureServices`, `None` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Private Endpoint Connections | `Microsoft.Search/searchServices/privateEndpointConnections` | Private networking |
| Shared Private Link Resources | `Microsoft.Search/searchServices/sharedPrivateLinkResources` | Outbound private connections to data sources |
| Network Security Perimeter | `Microsoft.Search/searchServices/networkSecurityPerimeterConfigurations` | NSP configuration |

## References

- [Bicep resource reference (2025-05-01)](https://learn.microsoft.com/azure/templates/microsoft.search/searchservices?pivots=deployment-language-bicep)
- [All API versions](https://learn.microsoft.com/azure/templates/microsoft.search/allversions)
- [Azure naming rules — Search](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftsearch)
- [Service limits](https://learn.microsoft.com/azure/search/search-limits-quotas-capacity)
- [CAF abbreviations](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)
