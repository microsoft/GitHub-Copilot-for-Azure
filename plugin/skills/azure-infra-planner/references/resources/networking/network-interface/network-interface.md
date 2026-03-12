# Network Interface

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/networkInterfaces` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `nic` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Network Interface does not use `kind`.

## SKU Names

Network Interface does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `nic-{vm-name}-{instance}` |
| Example | `nic-vm-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.ipConfigurations[].properties.subnet.id` | Subnet reference | Resource ID |
| `properties.ipConfigurations[].properties.privateIPAllocationMethod` | IP allocation | `Dynamic`, `Static` |
| `properties.ipConfigurations[].properties.privateIPAddress` | Static private IP | IP address string (required when allocation is `Static`) |
| `properties.ipConfigurations[].properties.publicIPAddress.id` | Public IP reference | Resource ID |
| `properties.ipConfigurations[].properties.primary` | Primary IP config | `true`, `false` |
| `properties.enableAcceleratedNetworking` | SR-IOV acceleration | `true`, `false` |
| `properties.enableIPForwarding` | IP forwarding (for NVAs) | `true`, `false` |
| `properties.networkSecurityGroup.id` | NSG association | Resource ID |
| `properties.dnsSettings.dnsServers` | Custom DNS servers | Array of IP strings |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Network Interface has no significant Bicep child resources — IP configurations are inline.

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/networkinterfaces?pivots=deployment-language-bicep)
- [Network interfaces overview](https://learn.microsoft.com/azure/virtual-network/virtual-network-network-interface)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Accelerated networking](https://learn.microsoft.com/azure/virtual-network/accelerated-networking-overview)
