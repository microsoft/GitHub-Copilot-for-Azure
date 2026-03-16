# Virtual Machine

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Compute/virtualMachines` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `vm` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Virtual Machine does not use `kind`.

## SKU Names

VM does not use a top-level `sku` block. VM size is set via `properties.hardwareProfile.vmSize`:

| vmSize Example | Family | Use Case |
|----------------|--------|----------|
| `Standard_B2s` | Burstable | Dev/test, low-traffic web servers |
| `Standard_D2s_v5` | General purpose | Balanced compute/memory |
| `Standard_E4s_v5` | Memory optimized | Databases, in-memory caching |
| `Standard_F4s_v2` | Compute optimized | Batch processing, analytics |
| `Standard_L8s_v3` | Storage optimized | Large data, high disk throughput |
| `Standard_NC6s_v3` | GPU | ML training, rendering |

> **Note:** VM sizes are not a closed enum. Use `az vm list-sizes --location {region}` or Resource Graph to discover valid values for a given region.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 15 (Windows hostname) / 64 (Linux / resource name) |
| Allowed Characters | Alphanumerics, hyphens, underscores. Linux: periods allowed (not at end). Windows: no periods at all. |
| Scope | Resource group |
| Pattern | `vm-{workload}-{env}-{instance}` |
| Example | `vm-webserver-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.hardwareProfile.vmSize` | VM size | Any valid size string (e.g. `Standard_D2s_v5`) |
| `properties.storageProfile.osDisk.createOption` | OS disk creation | `FromImage`, `Attach`, `Empty`, `Copy`, `Restore` |
| `properties.storageProfile.osDisk.managedDisk.storageAccountType` | Disk tier | `Premium_LRS`, `StandardSSD_LRS`, `Standard_LRS`, `PremiumV2_LRS`, `UltraSSD_LRS` |
| `properties.storageProfile.osDisk.caching` | Disk caching | `None`, `ReadOnly`, `ReadWrite` |
| `properties.storageProfile.osDisk.deleteOption` | Disk on VM delete | `Delete`, `Detach` |
| `properties.priority` | VM priority | `Regular`, `Spot`, `Low` |
| `properties.evictionPolicy` | Spot eviction | `Deallocate`, `Delete` (only when priority = Spot) |
| `properties.securityProfile.securityType` | Security type | `TrustedLaunch`, `ConfidentialVM` |
| `identity.type` | Managed identity | `None`, `SystemAssigned`, `UserAssigned`, `SystemAssigned, UserAssigned` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Extensions | `Microsoft.Compute/virtualMachines/extensions` | VM agents and scripts |
| Run Commands | `Microsoft.Compute/virtualMachines/runCommands` | Execute scripts on VM |

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.compute/virtualmachines?pivots=deployment-language-bicep)
- [Virtual Machines overview](https://learn.microsoft.com/azure/virtual-machines/overview)
- [Azure naming rules — Compute](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute)
- [VM sizes](https://learn.microsoft.com/azure/virtual-machines/sizes/overview)
