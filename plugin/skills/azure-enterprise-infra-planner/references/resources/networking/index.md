### Networking

| Resource | ARM Type | File | CAF Prefix | Naming Scope | Region Category |
|----------|----------|------|------------|--------------|-----------------|
| Virtual Network | `Microsoft.Network/virtualNetworks` | [virtual-network.md](virtual-network/virtual-network.md) | `vnet` | Resource group | Foundational |
| Subnet | `Microsoft.Network/virtualNetworks/subnets` | [subnet.md](subnet/subnet.md) | `snet` | Parent VNet | Foundational |
| NSG | `Microsoft.Network/networkSecurityGroups` | [nsg.md](nsg/nsg.md) | `nsg` | Resource group | Foundational |
| Public IP | `Microsoft.Network/publicIPAddresses` | [public-ip.md](public-ip/public-ip.md) | `pip` | Resource group | Foundational |
| Load Balancer | `Microsoft.Network/loadBalancers` | [load-balancer.md](load-balancer/load-balancer.md) | `lbi`/`lbe` | Resource group | Foundational |
| Application Gateway | `Microsoft.Network/applicationGateways` | [application-gateway.md](application-gateway/application-gateway.md) | `agw` | Resource group | Foundational |
| VPN Gateway | `Microsoft.Network/virtualNetworkGateways` | [vpn-gateway.md](vpn-gateway/vpn-gateway.md) | `vpng` | Resource group | Foundational |
| Azure Firewall | `Microsoft.Network/azureFirewalls` | [azure-firewall.md](azure-firewall/azure-firewall.md) | `afw` | Resource group | Mainstream |
| Azure Bastion | `Microsoft.Network/bastionHosts` | [azure-bastion.md](azure-bastion/azure-bastion.md) | `bas` | Resource group | Mainstream |
| Private Endpoint | `Microsoft.Network/privateEndpoints` | [private-endpoint.md](private-endpoint/private-endpoint.md) | `pep` | Resource group | Foundational |
| Private DNS Zone | `Microsoft.Network/privateDnsZones` | [private-dns-zone.md](private-dns-zone/private-dns-zone.md) | *(domain)* | Resource group | Foundational |
| Network Interface | `Microsoft.Network/networkInterfaces` | [network-interface.md](network-interface/network-interface.md) | `nic` | Resource group | Foundational |
| NAT Gateway | `Microsoft.Network/natGateways` | [nat-gateway.md](nat-gateway/nat-gateway.md) | `ng` | Resource group | Foundational |
| Route Table | `Microsoft.Network/routeTables` | [route-table.md](route-table/route-table.md) | `rt` | Resource group | Foundational |
| DNS Zone | `Microsoft.Network/dnsZones` | [dns-zone.md](dns-zone/dns-zone.md) | *(domain)* | Resource group | Foundational |
| Front Door | `Microsoft.Cdn/profiles` | [front-door.md](front-door/front-door.md) | `afd` | Resource group | Foundational |
| API Management | `Microsoft.ApiManagement/service` | [api-management.md](api-management/api-management.md) | `apim` | Global | Mainstream |
