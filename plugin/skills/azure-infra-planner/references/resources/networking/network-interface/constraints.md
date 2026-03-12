## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Virtual Machine** | Each VM requires at least one NIC. NIC must be in the same region and subscription as the VM. |
| **Subnet** | NIC must reference a subnet. The subnet determines the VNet, NSG, and route table that apply. |
| **NSG** | NSG can be associated at the NIC level or at the subnet level (or both). NIC-level NSG is evaluated after subnet-level NSG. |
| **Public IP** | Public IP and NIC must be in the same region. When associated with a Load Balancer, Public IP SKU must match the LB SKU (Basic with Basic, Standard with Standard). |
| **Load Balancer** | NIC IP configuration can reference `loadBalancerBackendAddressPools` and `loadBalancerInboundNatRules`. Load balancer and NIC must be in the same VNet. |
| **Accelerated Networking** | Not all VM sizes support accelerated networking. Must verify VM size compatibility. |
| **VM Scale Set** | NICs for VMSS instances are managed by the scale set — do not create standalone NICs for VMSS. |
| **Application Gateway** | NIC IP configuration can reference `applicationGatewayBackendAddressPools`. |
