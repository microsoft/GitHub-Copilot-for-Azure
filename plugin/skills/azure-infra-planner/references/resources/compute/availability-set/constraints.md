## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Virtual Machine** | VMs must be in the same resource group. Set `vm.properties.availabilitySet.id`. |
| **Availability Zones** | Cannot combine with zones — availability zones supersede availability sets for zone-redundant architectures. |
| **Managed Disks** | `sku.name` must be `Aligned` when VMs use managed disks. |
| **VM Scale Set** | A VM cannot be in both an availability set and a VMSS. |
