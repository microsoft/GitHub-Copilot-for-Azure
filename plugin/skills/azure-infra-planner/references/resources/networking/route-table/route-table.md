# Route Table

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/routeTables` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `rt` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Route Table does not use `kind`.

## SKU Names

Route Table does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `rt-{workload}-{env}-{instance}` |
| Example | `rt-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.disableBgpRoutePropagation` | Disable BGP route propagation | `true`, `false` (default: `false`) |
| `properties.routes[].properties.addressPrefix` | Destination CIDR | CIDR string (e.g., `0.0.0.0/0`, `10.1.0.0/16`) |
| `properties.routes[].properties.nextHopType` | Next hop type | `Internet`, `VirtualAppliance`, `VnetLocal`, `VirtualNetworkGateway`, `None` |
| `properties.routes[].properties.nextHopIpAddress` | Next hop IP | IP address string (required for `VirtualAppliance`) |
| `properties.routes[].properties.hasBgpOverride` | Override BGP route | `true`, `false` |

### Next Hop Types

| Next Hop Type | Description |
|---------------|-------------|
| `Internet` | Route traffic to the internet |
| `VirtualAppliance` | Route to a network virtual appliance (e.g., Azure Firewall NVA IP) |
| `VnetLocal` | Route within the virtual network |
| `VirtualNetworkGateway` | Route to a VPN/ExpressRoute gateway |
| `None` | Drop traffic (black hole) |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Routes | `Microsoft.Network/routeTables/routes` | Individual route entries (alternative to inline) |

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/routetables?pivots=deployment-language-bicep)
- [Virtual network traffic routing](https://learn.microsoft.com/azure/virtual-network/virtual-networks-udr-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Forced tunneling](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-forced-tunneling-rm)
