# DNS Zone

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/dnsZones` |
| Bicep API Version | `2018-05-01` |
| CAF Prefix | *(none — name is the DNS domain, e.g., `contoso.com`)* |

## Region Availability

**Category:** Foundational — global resource, available in all Azure regions.

> **Note:** DNS Zones use `location: 'global'` — they are not region-scoped.

## Subtypes (`properties.zoneType`)

DNS Zone uses `properties.zoneType` (not `kind`) to distinguish zone types:

| zoneType | Description |
|----------|-------------|
| `Public` | Public DNS zone — **default** |
| `Private` | Private DNS zone (use `Microsoft.Network/privateDnsZones` instead) |

> **Note:** For private DNS zones, use the separate `Microsoft.Network/privateDnsZones` resource type (see [private-dns-zone.md](../private-dns-zone/private-dns-zone.md)).

## SKU Names

DNS Zone does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 (per label) |
| Max Length | 63 characters per label, up to 34 labels, total max 253 characters |
| Allowed Characters | Alphanumerics, hyphens per label, separated by periods. Labels cannot start or end with hyphen. |
| Scope | Resource group |
| Pattern | *(use the actual DNS domain name)* |
| Example | `contoso.com` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `location` | Must be `'global'` | `global` |
| `properties.zoneType` | Zone type | `Public` (default), `Private` |
| `tags` | Resource tags | Object of key/value pairs |

> **Note:** DNS Zone top-level properties are minimal. Records are managed via child resources.

### Read-Only Properties

| Property | Description |
|----------|-------------|
| `properties.nameServers` | Azure-assigned name servers (NS records) |
| `properties.numberOfRecordSets` | Count of record sets in the zone |
| `properties.maxNumberOfRecordSets` | Maximum allowed record sets |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| A Records | `Microsoft.Network/dnsZones/A` | IPv4 address records |
| AAAA Records | `Microsoft.Network/dnsZones/AAAA` | IPv6 address records |
| CNAME Records | `Microsoft.Network/dnsZones/CNAME` | Canonical name (alias) records |
| MX Records | `Microsoft.Network/dnsZones/MX` | Mail exchange records |
| NS Records | `Microsoft.Network/dnsZones/NS` | Name server delegation records |
| TXT Records | `Microsoft.Network/dnsZones/TXT` | Text records (verification, SPF, etc.) |
| SRV Records | `Microsoft.Network/dnsZones/SRV` | Service locator records |
| CAA Records | `Microsoft.Network/dnsZones/CAA` | Certificate authority authorization records |
| SOA Records | `Microsoft.Network/dnsZones/SOA` | Start of authority records |

## References

- [Bicep resource reference (2018-05-01)](https://learn.microsoft.com/azure/templates/microsoft.network/dnszones?pivots=deployment-language-bicep)
- [Azure DNS overview](https://learn.microsoft.com/azure/dns/dns-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Delegate a domain to Azure DNS](https://learn.microsoft.com/azure/dns/dns-delegate-domain-azure-dns)
