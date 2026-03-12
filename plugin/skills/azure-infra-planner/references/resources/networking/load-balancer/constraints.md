## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Public IP** | Public IP SKU must match LB SKU. Basic LB requires Basic public IP; Standard LB requires Standard public IP. No cross-SKU mixing. |
| **Standard SKU** | Backend pool VMs must be in the same VNet. No VMs from different VNets. Standard LB blocks outbound traffic by default — requires explicit outbound rules, NAT gateway, or instance-level public IPs. Standard LB requires an NSG (secure by default; inbound traffic blocked without NSG). |
| **Basic SKU** | Backend pool VMs must be in the same availability set or VMSS. |
| **Availability Zones** | Standard SKU is zone-redundant by default. Frontend IPs inherit zone from public IP. |
| **VMs / VMSS** | VMs in backend pool cannot have both Basic and Standard LBs simultaneously. |
| **Outbound Rules** | Only Standard SKU supports outbound rules. Basic SKU has implicit outbound. |
