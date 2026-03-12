# VPN Gateway

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/virtualNetworkGateways` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `vpng` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

VPN Gateway does not use `kind`. The gateway type is set via `properties.gatewayType`.

### Gateway Types

| Gateway Type | Description |
|--------------|-------------|
| `Vpn` | VPN gateway (site-to-site, point-to-site, VNet-to-VNet) |
| `ExpressRoute` | ExpressRoute gateway |
| `LocalGateway` | Local network gateway |

### VPN Types (for `gatewayType: 'Vpn'`)

| VPN Type | Description |
|----------|-------------|
| `RouteBased` | Route-based VPN — **recommended**, required for most scenarios |
| `PolicyBased` | Policy-based VPN — limited to 1 S2S tunnel, IKEv1 only |

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `vpng-{workload}-{env}-{instance}` |
| Example | `vpng-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.gatewayType` | Gateway type | `Vpn`, `ExpressRoute`, `LocalGateway` |
| `properties.vpnType` | VPN type | `RouteBased`, `PolicyBased` |
| `properties.vpnGatewayGeneration` | Hardware generation | `Generation1`, `Generation2`, `None` |
| `properties.enableBgp` | Enable BGP | `true`, `false` |
| `properties.activeActive` | Active-active mode | `true`, `false` (requires 2 public IPs) |
| `properties.vpnClientConfiguration` | Point-to-site config | Object with `vpnClientAddressPool`, `vpnClientProtocols`, `vpnAuthenticationTypes` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| NAT Rules | `Microsoft.Network/virtualNetworkGateways/natRules` | NAT rule definitions |

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworkgateways?pivots=deployment-language-bicep)
- [VPN Gateway overview](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpngateways)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [VPN Gateway SKUs](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpn-gateway-settings#gwsku)
