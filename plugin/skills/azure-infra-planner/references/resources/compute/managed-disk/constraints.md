## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Virtual Machine** | Attach via `storageProfile.osDisk` or `storageProfile.dataDisks`. Disk must be in same region. |
| **Availability Zone** | `PremiumV2_LRS` and `UltraSSD_LRS` require zone specification. |
| **Premium SSD v2** | Cannot be used as OS disk (data disks only). Does not support host caching (`ReadOnly`/`ReadWrite` unavailable). Requires zonal VM deployment. Cannot mix with other storage types on SQL Server VMs. |
| **Key Vault (CMK)** | Requires a Disk Encryption Set pointing to Key Vault key. Key Vault must have purge protection enabled. |
