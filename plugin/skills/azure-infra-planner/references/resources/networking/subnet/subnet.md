# Subnet

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/virtualNetworks/subnets` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `snet` |
| Parent Resource | `Microsoft.Network/virtualNetworks` (see [virtual-network.md](../virtual-network/virtual-network.md)) |

## Region Availability

**Category:** Foundational — child resource; follows parent Virtual Network availability.

## Subtypes (kind)

Subnet does not use `kind` or `sku`.

## SKU Names

Subnet does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Parent virtual network |
| Pattern | `snet-{purpose}-{instance}` |
| Example | `snet-app-001` |

### Mandatory Subnet Names

Certain Azure services require exact subnet names:

| Service | Required Subnet Name | Minimum Prefix |
|---------|----------------------|----------------|
| Azure Firewall | `AzureFirewallSubnet` | /26 |
| Azure Firewall Management | `AzureFirewallManagementSubnet` | /26 |
| Azure Bastion | `AzureBastionSubnet` | /26 |
| VPN Gateway | `GatewaySubnet` | /27 |
| Route Server | `RouteServerSubnet` | /27 |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.addressPrefix` | CIDR block for the subnet | CIDR string |
| `properties.networkSecurityGroup.id` | Associated NSG | Resource ID |
| `properties.routeTable.id` | Associated route table | Resource ID |
| `properties.serviceEndpoints[].service` | Service endpoints | `Microsoft.Storage`, `Microsoft.Sql`, `Microsoft.KeyVault`, `Microsoft.AzureCosmosDB`, etc. |
| `properties.delegations[].properties.serviceName` | Subnet delegation | Service name string (e.g., `Microsoft.Web/serverFarms`) |
| `properties.privateEndpointNetworkPolicies` | Private endpoint policies | `Disabled`, `Enabled`, `NetworkSecurityGroupEnabled`, `RouteTableEnabled` |
| `properties.privateLinkServiceNetworkPolicies` | Private link policies | `Disabled`, `Enabled` |
| `properties.natGateway.id` | NAT Gateway association | Resource ID |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Subnet has no child resource types.

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworks/subnets?pivots=deployment-language-bicep)
- [Virtual Network subnets](https://learn.microsoft.com/azure/virtual-network/virtual-network-manage-subnet)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Subnet delegation](https://learn.microsoft.com/azure/virtual-network/subnet-delegation-overview)
