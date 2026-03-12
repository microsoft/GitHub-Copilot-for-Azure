# Load Balancer

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/loadBalancers` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `lbi` (internal) / `lbe` (external) |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Load Balancer does not use `kind`.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `Basic` | `Regional` | Basic — limited features, **being retired** |
| `Standard` | `Regional` | Standard — zone-redundant, recommended |
| `Standard` | `Global` | Global cross-region load balancer |
| `Gateway` | `Regional` | Gateway load balancer for NVA chaining |

> **Note:** Basic SKU is being retired September 2025. Always use `Standard` for new deployments.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `lbi-{workload}-{env}-{instance}` or `lbe-{workload}-{env}-{instance}` |
| Example | `lbe-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.frontendIPConfigurations[].properties.publicIPAddress.id` | Public IP for external LB | Resource ID |
| `properties.frontendIPConfigurations[].properties.subnet.id` | Subnet for internal LB | Resource ID |
| `properties.frontendIPConfigurations[].properties.privateIPAllocationMethod` | Private IP method | `Dynamic`, `Static` |
| `properties.backendAddressPools[].name` | Backend pool name | String |
| `properties.loadBalancingRules[].properties.protocol` | Rule protocol | `All`, `Tcp`, `Udp` |
| `properties.probes[].properties.protocol` | Probe protocol | `Http`, `Https`, `Tcp` |
| `properties.probes[].properties.port` | Probe port | Integer |
| `properties.probes[].properties.intervalInSeconds` | Probe interval | Integer (default `15`) |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Backend Pools | `Microsoft.Network/loadBalancers/backendAddressPools` | Backend address pools |
| Inbound NAT Rules | `Microsoft.Network/loadBalancers/inboundNatRules` | Port forwarding rules |

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/loadbalancers?pivots=deployment-language-bicep)
- [Load Balancer overview](https://learn.microsoft.com/azure/load-balancer/load-balancer-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Standard Load Balancer](https://learn.microsoft.com/azure/load-balancer/load-balancer-standard-overview)
