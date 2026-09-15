---
name: azure-virtual-network
description: "Design, deploy, and manage Azure Virtual Networks including subnets, peering, NSGs, ASGs, service endpoints, UDRs, VNet encryption, and IP addressing. WHEN: create vnet, virtual network, subnet, peering, NSG, network security group, ASG, service endpoint, UDR, route table, IP address, public IP, VNet encryption. DO NOT USE FOR: private endpoints (use azure-private-link), DNS zones (use azure-dns), VPN or ExpressRoute connectivity (use azure-vpn-gateway or azure-expressroute)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Virtual Network Skill

## When to Use This Skill

- User wants to create, modify, or troubleshoot an Azure Virtual Network or subnet
- User needs to configure VNet peering (regional or global)
- User asks about Network Security Groups (NSGs) or Application Security Groups (ASGs)
- User needs to set up User-Defined Routes (UDRs) or route tables
- User wants to manage public or private IP addresses, IP prefixes
- User asks about service endpoints for PaaS services
- User needs to enable VNet encryption
- User asks about VNet address space planning or subnet design
- User wants to understand network traffic flow or filtering

## Rules

1. Always recommend Standard SKU public IPs for new deployments — Basic SKU is retiring.
2. Reserve at least 5 addresses per subnet (Azure reserves the first 4 and last 1 in each subnet).
3. Never overlap address spaces between VNets that need to peer.
4. Always pair NSG rules with a justification — deny-all-inbound is the default implicit rule.
5. Recommend service endpoints only when private endpoints are not available or not suitable — private endpoints are preferred for new designs.
6. When creating peering, remind users that peering must be created in BOTH directions.
7. For UDRs, always confirm the next hop type and IP before applying — incorrect routes cause outages.
8. Subnet delegation locks a subnet to a single service — do not mix delegated and non-delegated resources.
9. VNet encryption requires supported VM SKUs (Accelerated Networking capable) and is region-specific.
10. Always validate that address space changes won't break existing peerings or connected resources.

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Virtual Network | Creating or managing VNets and subnets | `azure__network` → `vnet_list`, `vnet_get` | `az network vnet create/update/show/list` |
| Network Security Group | Filtering network traffic with security rules | `azure__network` → `nsg_list`, `nsg_get` | `az network nsg create/show/list`, `az network nsg rule create` |
| VNet Peering | Connecting VNets within or across regions | — | `az network vnet peering create/show/list` |
| Public IP Address | Assigning public connectivity to resources | `azure__network` → `public_ip_list` | `az network public-ip create/show/list` |
| Route Table / UDR | Controlling traffic routing in subnets | `azure__network` → `route_table_list` | `az network route-table create`, `az network route-table route create` |
| Service Endpoints | Securing PaaS service access from VNet | — | `az network vnet subnet update --service-endpoints` |
| Application Security Group | Grouping VMs for NSG rules without IPs | — | `az network asg create` |

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__network` | `vnet_list` | List all VNets in a subscription or resource group |
| `azure__network` | `vnet_get` | Get details of a specific VNet including subnets and peerings |
| `azure__network` | `nsg_list` | List all NSGs in a subscription or resource group |
| `azure__network` | `nsg_get` | Get NSG details including all security rules |
| `azure__network` | `public_ip_list` | List all public IP addresses |
| `azure__network` | `route_table_list` | List all route tables and their routes |

## CLI Fallback

```bash
# VNet operations
az network vnet create -g MyRG -n MyVNet --address-prefix 10.0.0.0/16 --subnet-name default --subnet-prefix 10.0.0.0/24
az network vnet show -g MyRG -n MyVNet
az network vnet list -g MyRG -o table
az network vnet subnet create -g MyRG --vnet-name MyVNet -n AppSubnet --address-prefix 10.0.1.0/24

# NSG operations
az network nsg create -g MyRG -n MyNSG
az network nsg rule create -g MyRG --nsg-name MyNSG -n AllowHTTPS --priority 100 \
  --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 443
az network nsg show -g MyRG -n MyNSG

# VNet peering
az network vnet peering create -g MyRG -n Peer1to2 --vnet-name VNet1 \
  --remote-vnet /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/VNet2 \
  --allow-vnet-access
az network vnet peering list -g MyRG --vnet-name VNet1 -o table

# Public IP
az network public-ip create -g MyRG -n MyPublicIP --sku Standard --allocation-method Static
az network public-ip list -g MyRG -o table

# Route table
az network route-table create -g MyRG -n MyRouteTable
az network route-table route create -g MyRG --route-table-name MyRouteTable -n ToFirewall \
  --address-prefix 0.0.0.0/0 --next-hop-type VirtualAppliance --next-hop-ip-address 10.0.2.4

# Application Security Group
az network asg create -g MyRG -n WebServers
```

## Key Concepts

### Address Space Planning

| VNet Size | CIDR | Hosts | Typical Use |
|-----------|------|-------|-------------|
| Small | /24 | 251 | Dev/test, single workload |
| Medium | /20 | 4,091 | Departmental, few subnets |
| Large | /16 | 65,531 | Hub VNet, many subnets |
| Extra Large | /12 | 1,048,571 | Enterprise hub with growth |

### Azure Reserved Addresses (per subnet)

| Address | Purpose |
|---------|---------|
| x.x.x.0 | Network address |
| x.x.x.1 | Default gateway |
| x.x.x.2-3 | Azure DNS mapping |
| x.x.x.255 | Broadcast (last address) |

### NSG Rule Processing Order

1. Inbound: NSG on subnet → NSG on NIC (lowest priority number wins)
2. Outbound: NSG on NIC → NSG on subnet (lowest priority number wins)
3. Lower priority number = higher precedence (100 beats 200)
4. Default rules exist at priority 65000-65500 (cannot delete, can override)

## References

- [VNet Fundamentals](references/vnet-fundamentals.md)
- [NSG Rules Guide](references/nsg-rules.md)
- [Peering Guide](references/peering-guide.md)
- [IP Addressing](references/ip-addressing.md)
- [UDR Guide](references/udr-guide.md)
- [Service Endpoints](references/service-endpoints.md)
