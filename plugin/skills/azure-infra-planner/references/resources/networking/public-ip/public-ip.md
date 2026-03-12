# Public IP Address

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/publicIPAddresses` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `pip` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Public IP does not use `kind`.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `Basic` | `Regional` | Basic SKU — **being retired**, avoid for new deployments |
| `Standard` | `Regional` | Standard SKU — zone-redundant, static only |
| `Standard` | `Global` | Global Standard for cross-region load balancer |
| `StandardV2` | `Regional` | Standard v2 — routing preference support |

> **Note:** Basic SKU is being retired September 2025. Always use `Standard` for new deployments.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `pip-{workload}-{env}-{region}-{instance}` |
| Example | `pip-datapipeline-prod-eastus2-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.publicIPAllocationMethod` | Allocation method | `Dynamic`, `Static` |
| `properties.publicIPAddressVersion` | IP version | `IPv4`, `IPv6` |
| `properties.idleTimeoutInMinutes` | TCP idle timeout | `4` to `30` (default: `4`) |
| `properties.dnsSettings.domainNameLabel` | DNS label | Lowercase alphanumeric, globally unique in region |
| `properties.ddosSettings.protectionMode` | DDoS protection | `Disabled`, `Enabled`, `VirtualNetworkInherited` |
| `zones` | Availability zones | `['1']`, `['2']`, `['3']`, or `['1','2','3']` for zone-redundant |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Public IP has no child resource types.

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/publicipaddresses?pivots=deployment-language-bicep)
- [Public IP overview](https://learn.microsoft.com/azure/virtual-network/ip-services/public-ip-addresses)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Basic SKU retirement](https://learn.microsoft.com/azure/virtual-network/ip-services/public-ip-basic-upgrade-guidance)
