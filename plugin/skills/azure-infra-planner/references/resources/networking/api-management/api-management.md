# API Management

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.ApiManagement/service` |
| Bicep API Version | `2024-05-01` |
| CAF Prefix | `apim` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

API Management does not use `kind`.

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 50 |
| Allowed Characters | Alphanumerics and hyphens. Must start with a letter, end with alphanumeric. |
| Scope | Global (must be globally unique as DNS name `{name}.azure-api.net`) |
| Pattern | `apim-{workload}-{env}-{instance}` |
| Example | `apim-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | Pricing tier | `Consumption`, `Developer`, `Basic`, `BasicV2`, `Standard`, `StandardV2`, `Premium`, `PremiumV2`, `Isolated` |
| `sku.capacity` | Scale units | Integer (`0` for Consumption, `1`+ for others) |
| `properties.publisherEmail` | Publisher email | Email string (required) |
| `properties.publisherName` | Publisher name | String (required) |
| `properties.virtualNetworkType` | VNet integration mode | `None`, `External`, `Internal` |
| `properties.virtualNetworkConfiguration.subnetResourceId` | VNet subnet | Resource ID |
| `properties.customProperties` | Custom settings | Object (e.g., `{ 'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'false' }`) |
| `properties.publicNetworkAccess` | Public access | `Enabled`, `Disabled` |
| `properties.certificates` | Gateway certificates | Array of certificate configurations |
| `properties.hostnameConfigurations` | Custom domains | Array of hostname/certificate pairs |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| APIs | `Microsoft.ApiManagement/service/apis` | API definitions |
| Products | `Microsoft.ApiManagement/service/products` | API product groupings |
| Subscriptions | `Microsoft.ApiManagement/service/subscriptions` | API access subscriptions |
| Named Values | `Microsoft.ApiManagement/service/namedValues` | Configuration properties |
| Loggers | `Microsoft.ApiManagement/service/loggers` | Application Insights / Event Hub loggers |
| Backends | `Microsoft.ApiManagement/service/backends` | Backend service definitions |
| Policies | `Microsoft.ApiManagement/service/policies` | Global API policies |

## References

- [Bicep resource reference (2024-05-01)](https://learn.microsoft.com/azure/templates/microsoft.apimanagement/service?pivots=deployment-language-bicep)
- [API Management overview](https://learn.microsoft.com/azure/api-management/api-management-key-concepts)
- [Azure naming rules — ApiManagement](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftapimanagement)
- [VNet integration](https://learn.microsoft.com/azure/api-management/virtual-network-concepts)
