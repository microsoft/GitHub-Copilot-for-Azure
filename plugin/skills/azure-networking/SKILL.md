---
name: azure-networking
description: Azure Networking Services including Virtual Networks, Private Endpoints, Load Balancers, Application Gateway, Front Door, and DNS. Covers hub-spoke topology, private endpoint patterns, and network security layers.
---

# Azure Networking Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Virtual Network | Private networking, subnets | - | `az network vnet` |
| Private Endpoints | Private PaaS access | - | `az network private-endpoint` |
| Load Balancer | Layer 4 load balancing | - | `az network lb` |
| Application Gateway | Layer 7 load balancing, WAF | - | `az network application-gateway` |
| Front Door | Global load balancing, CDN | - | `az afd` |
| DNS | Domain name resolution | - | `az network dns` |

## Common Patterns

### Hub-Spoke Topology

```
Hub VNet
├── Azure Firewall
├── VPN/ExpressRoute Gateway
├── Bastion Host
└── Central services

Spoke VNets (peered to hub)
├── Application Spoke
├── Data Spoke
└── Management Spoke
```

### Private Endpoint Pattern

Connect to PaaS services privately:

1. Create private endpoint in your VNet
2. Disable public access on PaaS resource
3. Configure private DNS zone
4. Access service via private IP

## CLI Reference

```bash
# Virtual Networks
az network vnet list --output table
az network vnet create -g RG -n VNET --address-prefix 10.0.0.0/16

# Subnets
az network vnet subnet list --vnet-name VNET -g RG --output table

# Private Endpoints
az network private-endpoint list --output table

# NSGs
az network nsg list --output table
az network nsg rule list --nsg-name NSG -g RG --output table

# Load Balancers
az network lb list --output table
```

## Security Layers

| Layer | Service | Purpose |
|-------|---------|---------|
| 4 | NSG | IP/port filtering |
| 7 | Azure Firewall | Application rules, threat intel |
| 7 | WAF | Web application protection |
| Edge | DDoS Protection | Attack mitigation |

## Service Details

For deep documentation on specific services:

- VNet design and peering -> `services/vnet.md`
- Private endpoints setup -> `services/private-endpoints.md`
- Load balancing options -> `services/load-balancing.md`
