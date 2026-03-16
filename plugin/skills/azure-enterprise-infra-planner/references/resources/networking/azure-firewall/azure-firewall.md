# Azure Firewall

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/azureFirewalls` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `afw` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

Azure Firewall does not use `kind`. The deployment mode is determined by `sku.name`.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `AZFW_VNet` | `Basic` | Basic — for SMB, limited features |
| `AZFW_VNet` | `Standard` | Standard — threat intelligence, DNS proxy, web categories |
| `AZFW_VNet` | `Premium` | Premium — Standard + IDPS, URL filtering, TLS inspection |
| `AZFW_Hub` | `Basic` | Basic in Virtual WAN hub |
| `AZFW_Hub` | `Standard` | Standard in Virtual WAN hub |
| `AZFW_Hub` | `Premium` | Premium in Virtual WAN hub |

> **Note:** `AZFW_VNet` deploys in a VNet. `AZFW_Hub` deploys in a Virtual WAN Hub (Secured Virtual Hub).

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 56 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `afw-{workload}-{env}-{instance}` |
| Example | `afw-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.sku.name` | Deployment mode | `AZFW_VNet`, `AZFW_Hub` |
| `properties.sku.tier` | Feature tier | `Basic`, `Standard`, `Premium` |
| `properties.threatIntelMode` | Threat intelligence mode | `Alert`, `Deny`, `Off` |
| `properties.firewallPolicy.id` | Attached policy | Resource ID of `Microsoft.Network/firewallPolicies` |
| `properties.natRuleCollections` | NAT rules (classic) | Array of rule collections |
| `properties.networkRuleCollections` | Network rules (classic) | Array of rule collections |
| `properties.applicationRuleCollections` | App rules (classic) | Array of rule collections |
| `zones` | Availability zones | `['1','2','3']` for zone-redundant |

> **Note:** Classic rule collections and `firewallPolicy` are mutually exclusive. Use Firewall Policy for new deployments.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Azure Firewall does not have significant Bicep child resources — rules are managed via inline collections or separate Firewall Policy resources.

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/azurefirewalls?pivots=deployment-language-bicep)
- [Azure Firewall overview](https://learn.microsoft.com/azure/firewall/overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Azure Firewall SKU comparison](https://learn.microsoft.com/azure/firewall/choose-firewall-sku)
