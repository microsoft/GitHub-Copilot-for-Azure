# Front Door

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Cdn/profiles` |
| Bicep API Version | `2025-06-01` |
| CAF Prefix | `afd` |

## Region Availability

**Category:** Foundational — global resource, available in all Azure regions.

> **Note:** Front Door is a global service. Set `location: 'global'` in Bicep.

## Subtypes (kind)

Front Door does not use `kind`. The `sku.name` determines whether the profile is a CDN or Front Door profile.

## SKU Names

Exact `sku.name` values for Bicep:

| SKU Name | Description |
|----------|-------------|
| `Standard_AzureFrontDoor` | Standard Front Door — global load balancing, SSL offload, WAF (managed rules) |
| `Premium_AzureFrontDoor` | Premium Front Door — adds Private Link origins, bot protection, enhanced WAF |
| `Standard_Microsoft` | Microsoft CDN Standard (not Front Door) |
| `Standard_Verizon` | Verizon CDN Standard (legacy) |
| `Premium_Verizon` | Verizon CDN Premium (legacy) |

> **Note:** For Azure Front Door, use only `Standard_AzureFrontDoor` or `Premium_AzureFrontDoor`.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 260 |
| Allowed Characters | Alphanumerics and hyphens. Must start and end with alphanumeric. |
| Scope | Resource group |
| Pattern | `afd-{workload}-{env}-{instance}` |
| Example | `afd-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | Profile tier | `Standard_AzureFrontDoor`, `Premium_AzureFrontDoor` |
| `properties.originResponseTimeoutSeconds` | Origin timeout | Integer (default: `60`, range: `16`–`240`) |
| `identity.type` | Managed identity | `SystemAssigned`, `UserAssigned`, `SystemAssigned,UserAssigned` |

> **Note:** Most configuration is on child resources (endpoints, origin groups, origins, routes, rule sets), not the profile itself.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Endpoints | `Microsoft.Cdn/profiles/afdEndpoints` | Front Door endpoint (generates `{name}.z01.azurefd.net` hostname) |
| Origin Groups | `Microsoft.Cdn/profiles/originGroups` | Group of backends with health probing and load balancing |
| Origins | `Microsoft.Cdn/profiles/originGroups/origins` | Individual backend servers |
| Routes | `Microsoft.Cdn/profiles/afdEndpoints/routes` | URL routing rules |
| Rule Sets | `Microsoft.Cdn/profiles/ruleSets` | Request/response manipulation rules |
| Rules | `Microsoft.Cdn/profiles/ruleSets/rules` | Individual rules within a rule set |
| Security Policies | `Microsoft.Cdn/profiles/securityPolicies` | WAF policy associations |
| Custom Domains | `Microsoft.Cdn/profiles/customDomains` | Custom domain definitions |
| Secrets | `Microsoft.Cdn/profiles/secrets` | Certificate references for custom domains |

## References

- [Bicep resource reference (2025-06-01)](https://learn.microsoft.com/azure/templates/microsoft.cdn/profiles?pivots=deployment-language-bicep)
- [Azure Front Door overview](https://learn.microsoft.com/azure/frontdoor/front-door-overview)
- [Azure naming rules — CDN](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcdn)
- [Front Door routing architecture](https://learn.microsoft.com/azure/frontdoor/front-door-routing-architecture)
