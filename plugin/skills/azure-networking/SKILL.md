---
name: azure-networking
description: Azure Networking - VNets, Private Endpoints, Load Balancers, App Gateway, Front Door, DNS.
---

# Azure Networking

## Services

| Service | Use | CLI |
|---------|-----|-----|
| Virtual Network | Private networking | `az network vnet` |
| Private Endpoints | Private PaaS access | `az network private-endpoint` |
| Load Balancer | L4 load balancing | `az network lb` |
| Application Gateway | L7 + WAF | `az network application-gateway` |
| Front Door | Global CDN | `az afd` |

## Hub-Spoke Pattern

Hub: Firewall, VPN/ExpressRoute Gateway, Bastion
Spokes: Application, Data, Management (peered to hub)

## Private Endpoint Pattern

1. Create endpoint in VNet → 2. Disable public access → 3. Configure private DNS → 4. Access via private IP

## CLI

```bash
az network vnet list -o table
az network vnet subnet list --vnet-name VNET -g RG -o table
az network private-endpoint list -o table
az network nsg list -o table
```

## Security Layers

| Layer | Service |
|-------|---------|
| L4 | NSG (IP/port) |
| L7 | Azure Firewall, WAF |
| Edge | DDoS Protection |

[VNet Docs](https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview) · [Private Link](https://learn.microsoft.com/azure/private-link/private-endpoint-overview)
