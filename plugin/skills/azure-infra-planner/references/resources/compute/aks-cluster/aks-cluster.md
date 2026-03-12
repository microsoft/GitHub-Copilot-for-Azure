# AKS Cluster

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.ContainerService/managedClusters` |
| Bicep API Version | `2025-05-01` |
| CAF Prefix | `aks` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

`kind` is a free-form string used for portal UI differentiation. Not a closed enum — typically omitted in Bicep.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `Base` | `Free` | Free tier — no SLA, no uptime guarantee |
| `Base` | `Standard` | Standard — production, 99.95% SLA with availability zones |
| `Base` | `Premium` | Premium — Standard + long-term support, mission-critical |
| `Automatic` | `Standard` | AKS Automatic — simplified managed experience |
| `Automatic` | `Premium` | AKS Automatic Premium |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 63 |
| Allowed Characters | Alphanumerics, underscores, and hyphens. Must start and end with alphanumeric. |
| Scope | Resource group |
| Pattern | `aks-{workload}-{env}-{instance}` |
| Example | `aks-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

See [properties.md](properties.md) for the complete list of key properties.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Agent Pools | `Microsoft.ContainerService/managedClusters/agentPools` | Additional node pools |
| Maintenance | `Microsoft.ContainerService/managedClusters/maintenanceConfigurations` | Maintenance windows |

## References

- [Bicep resource reference (2025-05-01)](https://learn.microsoft.com/azure/templates/microsoft.containerservice/managedclusters?pivots=deployment-language-bicep)
- [AKS overview](https://learn.microsoft.com/azure/aks/intro-kubernetes)
- [Azure naming rules — ContainerService](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcontainerservice)
- [AKS networking concepts](https://learn.microsoft.com/azure/aks/concepts-network)
