# Virtual WAN Architecture

## Overview

Azure Virtual WAN (vWAN) is a managed networking service that provides hub-and-spoke connectivity at scale. It replaces manually built hub VNets with Microsoft-managed virtual hubs that automate routing, connectivity, and security across branches, VNets, and remote users.

## vWAN Types

| Type | S2S VPN | P2S VPN | ExpressRoute | VNet-to-VNet Transit | Inter-Hub Transit | NVA-in-Hub | Routing Intent |
|------|---------|---------|-------------|---------------------|-------------------|------------|---------------|
| **Basic** | Yes | No | No | No | No | No | No |
| **Standard** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

**Always choose Standard** unless you have an extremely simple single-branch S2S-only scenario. Basic cannot be upgraded to Standard.

## Hub Components

A virtual hub is a Microsoft-managed VNet in a specific Azure region. It contains:

### Gateways

| Gateway Type | Scale Units | Throughput Per Unit | Max Throughput |
|-------------|-------------|-------------------|---------------|
| S2S VPN Gateway | 1-20 | 500 Mbps | 20 Gbps (with 20 units) |
| P2S VPN Gateway | 1-20 | 500 Mbps | 20 Gbps (with 20 units) |
| ExpressRoute Gateway | 1-10 | 2 Gbps | 10 Gbps (with 10 units) |

Gateways are deployed on-demand — you only pay for gateways you create.

```bash
# Create S2S VPN gateway in hub (1 scale unit = 500 Mbps)
az network vpn-gateway create \
  --name <vpngw-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --scale-unit 2

# Create ExpressRoute gateway in hub (1 scale unit = 2 Gbps)
az network express-route gateway create \
  --name <ergw-name> \
  --resource-group <rg> \
  --virtual-hub <hub-name> \
  --min-val 1

# Create P2S gateway in hub
az network p2s-vpn-gateway create \
  --name <p2sgw-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --scale-unit 1 \
  --vpn-server-config <server-config-name> \
  --address-space 172.16.0.0/24
```

### Hub Address Space

The hub requires a dedicated CIDR block:
- **Minimum:** /24
- **Recommended:** /23 (for growth with NVAs and future features)
- Must not overlap with any connected VNet, on-premises range, or other hub ranges
- Cannot be changed after creation

## Connectivity Models

### Branch Connectivity (S2S VPN)

Branches connect to the hub via IPsec/IKE S2S VPN tunnels. vWAN supports automated connectivity from SD-WAN partners.

```bash
# Create a VPN site (represents a branch)
az network vpn-site create \
  --name <site-name> \
  --resource-group <rg> \
  --virtual-wan <vwan-name> \
  --ip-address <branch-public-ip> \
  --address-prefixes 10.1.0.0/16 \
  --device-vendor <vendor> \
  --device-model <model>

# Connect VPN site to hub
az network vpn-gateway connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --gateway-name <vpngw-name> \
  --remote-vpn-site <site-resource-id> \
  --shared-key <psk>
```

### VNet Connectivity

VNets connect to hubs as spokes. The connection is a managed resource (not traditional peering).

```bash
# Connect spoke VNet to hub
az network vhub connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --vhub-name <hub-name> \
  --remote-vnet <vnet-resource-id>

# List VNet connections
az network vhub connection list \
  --resource-group <rg> \
  --vhub-name <hub-name>
```

**Key differences from VNet peering:**
- VNet connections are managed by vWAN routing
- Automatic route propagation between spokes (no UDRs needed)
- Cannot directly apply NSGs on the hub side
- Supports transit: spoke-to-spoke traffic flows through the hub

### ExpressRoute Connectivity

ExpressRoute circuits connect to the hub's ExpressRoute gateway.

```bash
# Connect an ExpressRoute circuit to the hub
az network express-route gateway connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --gateway-name <ergw-name> \
  --peering <circuit-peering-resource-id> \
  --authorization-key <auth-key>  # if cross-subscription
```

### Remote User Connectivity (P2S)

P2S VPN connects individual users to the hub, with the same protocol and auth options as standalone VPN Gateway P2S.

## Transit Connectivity

### Spoke-to-Spoke Transit

In Standard vWAN, spoke VNets connected to the **same hub** can communicate through the hub automatically. No additional routing configuration is needed.

### Inter-Hub Transit

Spokes connected to **different hubs** in the same vWAN can communicate across hubs. Traffic flows over the Microsoft global backbone between hub regions.

```
Spoke A (Hub 1, East US) ──→ Hub 1 ──→ Microsoft Backbone ──→ Hub 2 (West US) ──→ Spoke B
```

### Branch-to-VNet Transit

Branches connected via VPN can reach VNets connected to the same hub (and other hubs) automatically.

### Branch-to-Branch Transit

Branches connected to the same hub (or different hubs) can reach each other through the hub routing infrastructure.

### ExpressRoute-to-VPN Transit

Traffic from an ExpressRoute-connected site can reach VPN-connected branches through the hub. This requires Standard vWAN and both gateways in the same hub.

## Hub Routing

### Default Route Table

Every hub has a `defaultRouteTable` that receives routes from all connections:
- VNet connection addresses
- VPN site addresses
- ExpressRoute learned routes
- P2S client addresses

All connections propagate to and associate with the default route table by default.

### Custom Route Tables

For advanced routing (e.g., isolating certain spokes), you can create custom route tables:

```bash
# Create a custom route table
az network vhub route-table create \
  --name IsolatedRT \
  --resource-group <rg> \
  --vhub-name <hub-name>

# Associate a VNet connection with a custom route table
az network vhub connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --vhub-name <hub-name> \
  --associated-route-table <custom-rt-id> \
  --propagated-route-tables <default-rt-id>
```

### Effective Routes

```bash
# View effective routes for the hub
az network vhub get-effective-routes \
  --resource-group <rg> \
  --name <hub-name> \
  --resource-type VirtualHub

# View effective routes for a specific connection
az network vhub get-effective-routes \
  --resource-group <rg> \
  --name <hub-name> \
  --resource-type HubVnetConnection \
  --resource-id <connection-resource-id>
```

## SD-WAN Partner Integration

Validated SD-WAN partners can automate branch-to-hub connectivity through the vWAN REST API:

| Partner | Integration Type |
|---------|-----------------|
| Cisco Viptela / SD-WAN | Automated IPsec tunnels |
| VMware SD-WAN (VeloCloud) | Automated IPsec tunnels |
| Versa Networks | Automated IPsec tunnels |
| Barracuda CloudGen WAN | Automated IPsec tunnels + NVA-in-hub |
| Fortinet FortiGate | NVA-in-hub |
| Check Point CloudGuard | NVA-in-hub |

Partners automate the creation of VPN sites and connections, eliminating manual configuration for each branch.

## Migration from Traditional Hub-and-Spoke

### Planning Considerations

1. **Inventory all VNets, peerings, and gateways** in the existing topology
2. **Map UDRs** — vWAN replaces most UDRs with automatic routing
3. **Identify NVAs** — determine if they can move to NVA-in-hub or remain in spoke VNets
4. **Plan for downtime** — VNet connections must be removed from the old hub and connected to vWAN

### Migration Steps

1. Create the vWAN and hub(s)
2. Create gateways (VPN, ER) in the hub
3. Re-create VPN/ER connections to the hub
4. Disconnect spoke VNets from old hub (remove peerings)
5. Connect spoke VNets to vWAN hub
6. Verify routing and connectivity
7. Decommission old hub VNet and gateways

## Additional References

- [About Virtual WAN](https://learn.microsoft.com/azure/virtual-wan/virtual-wan-about)
- [Virtual WAN architecture](https://learn.microsoft.com/azure/virtual-wan/virtual-wan-global-transit-network-architecture)
- [Configure vWAN hub routing](https://learn.microsoft.com/azure/virtual-wan/how-to-virtual-hub-routing)
- [SD-WAN connectivity automation](https://learn.microsoft.com/azure/virtual-wan/virtual-wan-locations-partners)
