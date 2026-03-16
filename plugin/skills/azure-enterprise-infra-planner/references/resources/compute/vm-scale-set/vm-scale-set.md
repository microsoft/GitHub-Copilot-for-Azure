# VM Scale Set

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Compute/virtualMachineScaleSets` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `vmss` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

VM Scale Set does not use `kind`.

## SKU Names

| Field | Description | Value |
|-------|-------------|-------|
| `sku.name` | VM size | Any valid size string (e.g. `Standard_D2s_v5`) |
| `sku.tier` | SKU tier | `Standard`, `Basic` |
| `sku.capacity` | Instance count | Integer (initial number of VMs) |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 15 (Windows) / 64 (Linux) |
| Allowed Characters | Alphanumerics and hyphens. Cannot start with underscore. Cannot end with period or hyphen. Note: ARM resource name max is 64; OS hostname max is 15 (Windows) / 64 (Linux). |
| Scope | Resource group |
| Pattern | `vmss-{workload}-{env}-{instance}` |
| Example | `vmss-webfrontend-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.orchestrationMode` | Orchestration mode | `Flexible` (recommended), `Uniform` (legacy) |
| `properties.upgradePolicy.mode` | Upgrade policy | `Automatic`, `Manual`, `Rolling` |
| `properties.virtualMachineProfile.priority` | VM priority | `Regular`, `Spot`, `Low` |
| `properties.scaleInPolicy.rules` | Scale-in strategy | `Default`, `OldestVM`, `NewestVM` |
| `properties.skuProfile.allocationStrategy` | Spot allocation | `CapacityOptimized`, `LowestPrice`, `Prioritized` |
| `identity.type` | Managed identity | `None`, `SystemAssigned`, `UserAssigned`, `SystemAssigned, UserAssigned` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Extensions | `Microsoft.Compute/virtualMachineScaleSets/extensions` | VM agents and scripts |
| Virtual Machines | `Microsoft.Compute/virtualMachineScaleSets/virtualMachines` | Individual instances |
| Rolling Upgrades | `Microsoft.Compute/virtualMachineScaleSets/rollingUpgrades` | Upgrade orchestration |

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.compute/virtualmachinescalesets?pivots=deployment-language-bicep)
- [VM Scale Sets overview](https://learn.microsoft.com/azure/virtual-machine-scale-sets/overview)
- [Azure naming rules — Compute](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute)
