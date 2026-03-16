# NAT Gateway

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/natGateways` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `ng` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

NAT Gateway does not use `kind`.

## SKU Names

| SKU Name | Description |
|----------|-------------|
| `Standard` | Standard NAT Gateway — production workloads |

> **Note:** Only `Standard` SKU is available. Basic SKU does not exist for NAT Gateway.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `ng-{workload}-{env}-{instance}` |
| Example | `ng-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | SKU tier | `Standard` |
| `properties.idleTimeoutInMinutes` | Idle timeout | `4` to `120` (default: `4`) |
| `properties.publicIpAddresses` | Public IP associations | Array of `{ id: 'resourceId' }` |
| `properties.publicIpPrefixes` | Public IP prefix associations | Array of `{ id: 'resourceId' }` |
| `zones` | Availability zones | Array of strings (e.g., `['1']`, `['2']`, `['3']`) |

> **Note:** NAT Gateway supports up to 16 public IP addresses and/or public IP prefixes combined, providing up to 64,000 SNAT ports per IP.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

NAT Gateway has no Bicep child resources.

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/natgateways?pivots=deployment-language-bicep)
- [NAT Gateway overview](https://learn.microsoft.com/azure/nat-gateway/nat-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [NAT Gateway and availability zones](https://learn.microsoft.com/azure/nat-gateway/nat-availability-zones)
