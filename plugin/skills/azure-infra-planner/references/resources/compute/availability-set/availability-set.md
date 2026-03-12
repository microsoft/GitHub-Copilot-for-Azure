# Availability Set

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Compute/availabilitySets` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `avail` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Availability Set does not use `kind`.

## SKU Names

| SKU Name | Description |
|----------|-------------|
| `Aligned` | For managed disks — **required for modern deployments** |
| `Classic` | For unmanaged disks (legacy) — avoid for new deployments |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, and hyphens. Must start with alphanumeric. Must end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `avail-{workload}-{env}-{instance}` |
| Example | `avail-webserver-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | Disk alignment | `Aligned` (managed disks), `Classic` (unmanaged) |
| `properties.platformFaultDomainCount` | Fault domains | Integer, max `3` (region-dependent) |
| `properties.platformUpdateDomainCount` | Update domains | Integer, default `5`, max `20` |
| `properties.proximityPlacementGroup` | Proximity group | Resource ID of proximity placement group |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Availability Set has no Bicep child resource types.

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.compute/availabilitysets?pivots=deployment-language-bicep)
- [Availability sets overview](https://learn.microsoft.com/azure/virtual-machines/availability-set-overview)
- [Azure naming rules — Compute](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute)
