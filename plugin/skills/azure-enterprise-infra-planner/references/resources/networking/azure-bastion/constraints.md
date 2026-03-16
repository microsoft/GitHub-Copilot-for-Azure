## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `AzureBastionSubnet` with minimum /26 prefix. |
| **Developer SKU** | Does NOT require `AzureBastionSubnet` or public IP. Deploys as shared infrastructure. Only connects to VMs in the same VNet. |
| **Public IP** | Requires Standard SKU public IP with Static allocation. |
| **NSG** | NSG on `AzureBastionSubnet` requires mandatory inbound (HTTPS 443 from Internet, GatewayManager 443) and outbound rules (see [Bastion NSG docs](https://learn.microsoft.com/azure/bastion/bastion-nsg)). |
| **VMs** | Target VMs must be in the same VNet as Bastion (or peered VNets with Standard/Premium SKU). |
