## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Subnets** | Address prefixes of all subnets must fall within the VNet address space. Subnet CIDRs cannot overlap. |
| **VNet Peering** | Peered VNets cannot have overlapping address spaces. |
| **Azure Firewall** | Requires a subnet named exactly `AzureFirewallSubnet` with minimum /26 prefix. |
| **Azure Bastion** | Requires a subnet named exactly `AzureBastionSubnet` with minimum /26 prefix (recommended /26). |
| **VPN Gateway** | Requires a subnet named exactly `GatewaySubnet` with minimum /27 prefix (recommended /27). |
| **Application Gateway** | Requires a dedicated subnet (no mandatory name, but must not contain other resource types). |
| **AKS** | AKS subnet must have enough IP addresses for nodes + pods. With Azure CNI, each node reserves IPs for max pods. |
