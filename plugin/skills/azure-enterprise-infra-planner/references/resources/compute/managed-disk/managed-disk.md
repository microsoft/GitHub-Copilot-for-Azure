# Managed Disk

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Compute/disks` |
| Bicep API Version | `2025-01-02` |
| CAF Prefix | `osdisk` (OS) / `disk` (data) |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Managed Disk does not use `kind`.

## SKU Names

Exact `sku.name` values for Bicep:

| SKU | Description | Zone Redundancy |
|-----|-------------|-----------------|
| `Standard_LRS` | Standard HDD, locally redundant | No |
| `StandardSSD_LRS` | Standard SSD, locally redundant | No |
| `StandardSSD_ZRS` | Standard SSD, zone-redundant | Yes |
| `Premium_LRS` | Premium SSD, locally redundant | No |
| `Premium_ZRS` | Premium SSD, zone-redundant | Yes |
| `PremiumV2_LRS` | Premium SSD v2, locally redundant | No |
| `UltraSSD_LRS` | Ultra Disk, locally redundant | No |

> **Note:** `PremiumV2_LRS` and `UltraSSD_LRS` require availability zone specification.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, and hyphens |
| Scope | Resource group |
| Pattern | `osdisk-{workload}-{env}-{instance}` or `disk-{workload}-{env}-{instance}` |
| Example | `osdisk-webserver-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.creationData.createOption` | Disk creation method | `Empty`, `FromImage`, `Attach`, `Copy`, `Import`, `Restore`, `Upload` |
| `properties.diskSizeGB` | Disk size in GiB | Integer |
| `properties.osType` | OS type (for OS disks) | `Linux`, `Windows` |
| `properties.networkAccessPolicy` | Network access | `AllowAll`, `AllowPrivate`, `DenyAll` |
| `properties.publicNetworkAccess` | Public access | `Enabled`, `Disabled` |
| `properties.encryption.type` | Encryption type | `EncryptionAtRestWithPlatformKey`, `EncryptionAtRestWithCustomerKey`, `EncryptionAtRestWithPlatformAndCustomerKeys` |
| `properties.hyperVGeneration` | Hyper-V generation | `V1`, `V2` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Managed Disk has no Bicep child resource types.

## References

- [Bicep resource reference (2025-01-02)](https://learn.microsoft.com/azure/templates/microsoft.compute/disks?pivots=deployment-language-bicep)
- [Managed disks overview](https://learn.microsoft.com/azure/virtual-machines/managed-disks-overview)
- [Azure naming rules — Compute](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute)
