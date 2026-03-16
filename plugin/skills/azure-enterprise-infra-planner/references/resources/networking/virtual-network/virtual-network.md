# Virtual Network

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/virtualNetworks` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `vnet` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Virtual Network does not use `kind` or `sku`.

## SKU Names

Virtual Network does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 2 |
| Max Length | 64 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `vnet-{workload}-{env}-{region}-{instance}` |
| Example | `vnet-datapipeline-prod-eastus2-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.addressSpace.addressPrefixes` | CIDR address blocks | Array of CIDR strings |
| `properties.dhcpOptions.dnsServers` | Custom DNS servers | Array of IP strings |
| `properties.enableDdosProtection` | DDoS protection | `true`, `false` |
| `properties.ddosProtectionPlan.id` | DDoS plan resource ID | Resource ID string |
| `properties.encryption.enabled` | VNet encryption | `true`, `false` |
| `properties.encryption.enforcement` | Encryption enforcement | `AllowUnencrypted`, `DropUnencrypted` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Subnets | `Microsoft.Network/virtualNetworks/subnets` | Network segments (see [subnet.md](../subnet/subnet.md)) |
| VNet Peerings | `Microsoft.Network/virtualNetworks/virtualNetworkPeerings` | Cross-VNet connectivity |

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworks?pivots=deployment-language-bicep)
- [Virtual Network overview](https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [VNet planning](https://learn.microsoft.com/azure/virtual-network/virtual-network-vnet-plan-design-arm)
