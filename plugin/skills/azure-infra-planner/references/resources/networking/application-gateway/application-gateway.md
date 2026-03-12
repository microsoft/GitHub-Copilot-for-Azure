# Application Gateway

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/applicationGateways` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `agw` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Application Gateway does not use `kind`.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `Standard_v2` | `Standard_v2` | Standard v2 — **recommended**, zone-aware, autoscaling |
| `WAF_v2` | `WAF_v2` | WAF v2 — Standard_v2 + Web Application Firewall |
| `Basic` | `Basic` | Basic App Gateway (limited scenarios) |
| `Standard_Small` | `Standard` | v1 Small (legacy) |
| `Standard_Medium` | `Standard` | v1 Medium (legacy) |
| `Standard_Large` | `Standard` | v1 Large (legacy) |
| `WAF_Medium` | `WAF` | v1 WAF Medium (legacy) |
| `WAF_Large` | `WAF` | v1 WAF Large (legacy) |

### SKU Families (v2 only)

| Family | Description |
|--------|-------------|
| `Generation_1` | Gen1 hardware |
| `Generation_2` | Gen2 hardware |

> **Note:** v1 SKUs are being retired April 2026. Always use `Standard_v2` or `WAF_v2` for new deployments.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `agw-{workload}-{env}-{instance}` |
| Example | `agw-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.sku.name` | SKU name | See SKU Names table |
| `properties.sku.tier` | SKU tier | Must match SKU name |
| `properties.autoscaleConfiguration.minCapacity` | Min instances (v2) | Integer (`0` to `125`) |
| `properties.autoscaleConfiguration.maxCapacity` | Max instances (v2) | Integer (`2` to `125`) |
| `properties.webApplicationFirewallConfiguration.enabled` | Enable WAF | `true`, `false` (WAF SKUs only) |
| `properties.webApplicationFirewallConfiguration.firewallMode` | WAF mode | `Detection`, `Prevention` |
| `properties.sslCertificates[].properties.data` | SSL cert (base64 PFX) | Base64 string |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Private Endpoint Connections | `Microsoft.Network/applicationGateways/privateEndpointConnections` | Private link connections |

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/applicationgateways?pivots=deployment-language-bicep)
- [Application Gateway overview](https://learn.microsoft.com/azure/application-gateway/overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [App Gateway v2 features](https://learn.microsoft.com/azure/application-gateway/application-gateway-autoscaling-zone-redundant)
