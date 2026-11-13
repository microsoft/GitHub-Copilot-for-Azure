---
name: azure-route-server
description: "Deploy and manage Azure Route Server for dynamic BGP-based routing between network virtual appliances (NVAs) and Azure virtual networks. WHEN: route server, BGP peering, NVA routing, dynamic routing, branch-to-branch, RouteServerSubnet. DO NOT USE FOR: static route tables (use azure-virtual-network UDRs), VPN connectivity (use azure-vpn-gateway), DNS routing (use azure-traffic-manager), hub-spoke managed routing (use azure-virtual-wan)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Route Server Skill

## When to Use This Skill

- User wants to enable dynamic routing between NVAs and Azure VNets via BGP
- User needs route exchange between NVAs and Azure VPN/ExpressRoute gateways
- User asks about branch-to-branch transit through NVAs
- User wants to deploy a route server in a hub VNet
- User needs to troubleshoot BGP peering or route propagation issues
- User asks about RouteServerSubnet requirements

## Rules

1. Route Server requires a dedicated subnet named `RouteServerSubnet` with /27 or larger prefix.
2. Route Server uses ASN 65515 — NVA peers must use a different ASN (not 65515).
3. NVAs must peer with both Route Server instances (two IPs) for redundancy.
4. Enable branch-to-branch only when you need transit between VPN/ExpressRoute and NVAs.
5. Route Server supports up to 8 BGP peers.
6. Route Server does NOT forward data-plane traffic — it only exchanges routes.
7. Routes learned via Route Server are injected into the VNet's effective routes as "Virtual Network Gateway" type.
8. Route Server and VPN Gateway/ExpressRoute Gateway CAN coexist in the same VNet.
9. BGP peering is established over private IPs — NVA must be in the same VNet (or peered VNet).
10. Route Server supports multi-homed NVAs — it can learn the same prefix from multiple NVAs and program ECMP.

## MCP Tools

> Azure Route Server has limited MCP tool support. Use CLI commands for all operations.

## CLI Fallback

```bash
# Create RouteServerSubnet
az network vnet subnet create -g MyRG --vnet-name HubVNet -n RouteServerSubnet \
  --address-prefix 10.0.1.0/27

# Create public IP for Route Server
az network public-ip create -g MyRG -n RouteServerIP --sku Standard --allocation-method Static

# Create Route Server
az network routeserver create -g MyRG -n MyRouteServer --hosted-subnet \
  /subscriptions/{sub}/resourceGroups/MyRG/providers/Microsoft.Network/virtualNetworks/HubVNet/subnets/RouteServerSubnet \
  --public-ip-address RouteServerIP

# Add BGP peer (NVA)
az network routeserver peering create -g MyRG --routeserver MyRouteServer \
  -n NVAPeer1 --peer-asn 65001 --peer-ip 10.0.2.4

# List BGP peers
az network routeserver peering list -g MyRG --routeserver MyRouteServer -o table

# Show learned routes from a peer
az network routeserver peering list-learned-routes -g MyRG --routeserver MyRouteServer -n NVAPeer1

# Show advertised routes to a peer
az network routeserver peering list-advertised-routes -g MyRG --routeserver MyRouteServer -n NVAPeer1

# Enable branch-to-branch transit
az network routeserver update -g MyRG -n MyRouteServer --allow-b2b-traffic true

# Show Route Server details
az network routeserver show -g MyRG -n MyRouteServer
az network routeserver list -g MyRG -o table
```

## Key Concepts

### Route Server Architecture

| Component | Purpose |
|-----------|---------|
| Route Server | Managed BGP route reflector in your VNet |
| RouteServerSubnet | Dedicated /27+ subnet for Route Server instances |
| BGP Peer | NVA that exchanges routes via BGP (eBGP with ASN 65515) |
| Branch-to-branch | Enables transit between VPN/ER gateways and NVA peers |

### Route Precedence (when Route Server is deployed)

| Priority | Route Source | Notes |
|----------|-------------|-------|
| 1 (highest) | Longest prefix match | More specific route wins regardless of source |
| 2 | UDR (User-Defined Route) | Static UDR overrides BGP for same prefix |
| 3 | BGP routes | Routes learned from NVAs via Route Server |
| 4 | System routes | Azure default routes |

### Limits

| Resource | Limit |
|----------|-------|
| BGP peers per Route Server | 8 |
| Routes per BGP peer | 10,000 (Standard), 100 (Basic) |
| Route Servers per VNet | 1 |
| Route Servers per subscription | 1 (Basic), unlimited (Standard) |
| Supported NVA ASN range | 1-64495 (not 65515, not 65520 for ER) |

## References

- [BGP Peering Guide](references/bgp-peering.md)
- [NVA Integration Patterns](references/nva-integration.md)
