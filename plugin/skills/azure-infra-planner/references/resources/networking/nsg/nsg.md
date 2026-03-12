# Network Security Group

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/networkSecurityGroups` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `nsg` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

NSG does not use `kind` or `sku`.

## SKU Names

NSG does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `nsg-{workload}-{env}-{instance}` |
| Example | `nsg-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

### Security Rule Enums

| Property | Values |
|----------|--------|
| `access` | `Allow`, `Deny` |
| `direction` | `Inbound`, `Outbound` |
| `protocol` | `*`, `Ah`, `Esp`, `Icmp`, `Tcp`, `Udp` |

### Rule Properties

| Property | Description | Values |
|----------|-------------|--------|
| `priority` | Rule evaluation order (lower = first) | `100` to `4096` |
| `sourceAddressPrefix` | Source CIDR or tag | CIDR, `*`, `Internet`, `VirtualNetwork`, `AzureLoadBalancer` |
| `destinationAddressPrefix` | Destination CIDR or tag | CIDR, `*`, `Internet`, `VirtualNetwork` |
| `sourcePortRange` | Source port range | `*`, single port, or range `80-443` |
| `destinationPortRange` | Destination port range | `*`, single port, or range `80-443` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Security Rules | `Microsoft.Network/networkSecurityGroups/securityRules` | Individual security rules (alternative to inline) |

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/networksecuritygroups?pivots=deployment-language-bicep)
- [NSG overview](https://learn.microsoft.com/azure/virtual-network/network-security-groups-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [NSG security rules](https://learn.microsoft.com/azure/virtual-network/network-security-group-how-it-works)
