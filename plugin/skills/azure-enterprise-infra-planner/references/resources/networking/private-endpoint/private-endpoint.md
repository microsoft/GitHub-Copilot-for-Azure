# Private Endpoint

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/privateEndpoints` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `pep` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Private Endpoint does not use `kind`.

## SKU Names

Private Endpoint does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 2 |
| Max Length | 64 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `pep-{target-resource}-{env}-{instance}` |
| Example | `pep-stprod-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.subnet.id` | Subnet hosting the PE NIC | Resource ID of a subnet |
| `properties.privateLinkServiceConnections[].properties.privateLinkServiceId` | Target resource | Resource ID of the private-link-enabled resource |
| `properties.privateLinkServiceConnections[].properties.groupIds` | Sub-resource type | Array of strings (e.g., `['blob']`, `['vault']`, `['sqlServer']`, `['sites']`) |
| `properties.manualPrivateLinkServiceConnections` | Manual approval connections | Same structure as `privateLinkServiceConnections` (requires target owner approval) |
| `properties.customDnsConfigs` | Custom DNS records | Read-only — populated after creation |
| `properties.customNetworkInterfaceName` | Custom NIC name | String — name for the PE-managed NIC |
| `properties.ipConfigurations[].properties.privateIPAddress` | Static private IP | IP address string (optional — dynamic by default) |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Private DNS Zone Groups | `Microsoft.Network/privateEndpoints/privateDnsZoneGroups` | Auto-register DNS records in Private DNS Zones |

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/privateendpoints?pivots=deployment-language-bicep)
- [Private Endpoint overview](https://learn.microsoft.com/azure/private-link/private-endpoint-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Private DNS zone values](https://learn.microsoft.com/azure/private-link/private-endpoint-dns)
