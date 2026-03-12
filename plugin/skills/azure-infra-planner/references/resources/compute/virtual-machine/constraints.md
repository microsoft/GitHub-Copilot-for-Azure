## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **NIC** | At least one NIC required via `networkProfile.networkInterfaces`. NIC must be in the same region. |
| **Availability Set** | Cannot combine with `virtualMachineScaleSet` or availability zones. Set `availabilitySet.id`. |
| **Availability Zone** | Cannot combine with availability sets. Set `zones: ['1']` (string array). |
| **Managed Disk (Premium SSD)** | Not all VM sizes support Premium storage — check size docs for compatibility. |
| **Managed Disk (UltraSSD)** | Requires `additionalCapabilities.ultraSSDEnabled: true`. Cannot enable on a running VM — requires stop/deallocate first. |
| **Managed Disk (Premium SSD v2)** | Premium SSD v2 cannot be used as OS disk (data disks only). Does not support host caching (ReadOnly/ReadWrite unavailable). Requires zonal VM deployment. Cannot mix Premium SSD v2 with other storage types on SQL Server VMs. |
| **Dedicated Host** | Cannot specify both `host` and `hostGroup`. |
| **Boot Diagnostics Storage** | Cannot use Premium or ZRS storage. Use `Standard_LRS` or `Standard_GRS`. |
| **CNI Overlay (AKS)** | DCsv2-series VMs are not supported with Azure CNI Overlay. Use DCasv5/DCadsv5 for confidential computing. |
