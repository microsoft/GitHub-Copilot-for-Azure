# Active-Active VPN Gateway

## Overview

An active-active VPN gateway deploys two gateway instances, each with its own public IP address. This provides redundancy and higher aggregate throughput through parallel tunnels. Active-active is the recommended configuration for production workloads.

## Architecture

```
On-Premises VPN Device
├── Tunnel 1 → Azure GW Instance 0 (Public IP 1)
└── Tunnel 2 → Azure GW Instance 1 (Public IP 2)
```

In active-active mode:
- Both gateway instances are active simultaneously
- Each instance has its own public IP
- Both tunnels carry traffic (ECMP load balancing with BGP)
- If one instance fails, the other continues without interruption

For **dual-redundancy** (active-active on both sides):

```
On-Prem Device 1 ─── Tunnel 1 ──→ Azure GW Instance 0
On-Prem Device 1 ─── Tunnel 2 ──→ Azure GW Instance 1
On-Prem Device 2 ─── Tunnel 3 ──→ Azure GW Instance 0
On-Prem Device 2 ─── Tunnel 4 ──→ Azure GW Instance 1
```

This creates a full-mesh with four tunnels and maximum redundancy.

## Prerequisites

- **Route-based VPN gateway** (policy-based does not support active-active)
- **Two public IP addresses** (Standard SKU, static allocation)
- **BGP is mandatory** for active-active configurations
- Minimum SKU: **VpnGw1** or higher (Basic does not support active-active)
- On-premises VPN device must support BGP and multiple tunnels

## Deployment

### Create Active-Active Gateway

```bash
# Create two public IPs
az network public-ip create \
  --name <pip1-name> --resource-group <rg> \
  --allocation-method Static --sku Standard --zone 1 2 3

az network public-ip create \
  --name <pip2-name> --resource-group <rg> \
  --allocation-method Static --sku Standard --zone 1 2 3

# Create active-active VPN gateway with BGP
az network vnet-gateway create \
  --name <gw-name> \
  --resource-group <rg> \
  --vnet <vnet-name> \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw2AZ \
  --generation Generation2 \
  --public-ip-addresses <pip1-name> <pip2-name> \
  --asn 65515 \
  --no-wait
```

Note: Specifying two public IP addresses automatically enables active-active mode.

### Create Local Network Gateways (One Per On-Prem Tunnel Endpoint)

If the on-premises device has a single public IP, you still create a single local network gateway but establish two tunnels (one to each Azure gateway instance).

```bash
az network local-gateway create \
  --name <lgw-name> \
  --resource-group <rg> \
  --gateway-ip-address <on-prem-public-ip> \
  --local-address-prefixes 10.0.0.0/8 \
  --bgp-peering-address <on-prem-bgp-ip> \
  --asn <on-prem-asn>
```

### Create Two VPN Connections (One Per Gateway Instance)

```bash
# Connection to gateway instance 0
az network vpn-connection create \
  --name <conn1-name> \
  --resource-group <rg> \
  --vnet-gateway1 <gw-name> \
  --local-gateway2 <lgw-name> \
  --shared-key <psk> \
  --enable-bgp true

# Connection to gateway instance 1
az network vpn-connection create \
  --name <conn2-name> \
  --resource-group <rg> \
  --vnet-gateway1 <gw-name> \
  --local-gateway2 <lgw-name> \
  --shared-key <psk> \
  --enable-bgp true
```

Both connections target the same local network gateway but the gateway automatically distributes them across the two instances.

## BGP Configuration for Active-Active

### How BGP Works with Active-Active

Each gateway instance gets its own BGP peer IP from the GatewaySubnet:
- Instance 0: BGP IP = first usable IP from GatewaySubnet
- Instance 1: BGP IP = second usable IP from GatewaySubnet

The on-prem device must establish BGP sessions with **both** instance IPs.

### Retrieve Azure BGP Peer IPs

```bash
az network vnet-gateway show \
  --name <gw-name> \
  --resource-group <rg> \
  --query "bgpSettings.bgpPeeringAddresses[].{ip:defaultBgpIpAddresses, tunnelIp:tunnelIpAddresses}"
```

### On-Premises Device Configuration

The on-prem VPN device must:
1. Establish two IPsec tunnels — one to each Azure public IP
2. Configure BGP neighbor sessions to both Azure BGP peer IPs over the tunnels
3. Advertise the same on-prem prefixes to both BGP neighbors
4. Enable ECMP (Equal-Cost Multi-Path) to load-balance across both tunnels

### ECMP and Load Balancing

With active-active and BGP:
- Both tunnels advertise the same routes with equal metrics
- Azure uses ECMP to distribute traffic flows across both tunnels
- On-prem should also enable ECMP for balanced return traffic
- Individual TCP flows stick to one tunnel (per-flow hashing), but aggregate traffic is balanced

## Failover Behavior

| Scenario | Impact | Recovery |
|----------|--------|----------|
| Azure planned maintenance on one instance | Other instance handles all traffic. Brief disruption for flows on affected instance. | Automatic — flows re-establish on active instance. |
| On-prem tunnel to one instance fails | BGP detects failure, routes converge to remaining tunnel. | Automatic — BGP convergence in seconds to minutes. |
| Both tunnels fail (complete outage) | All connectivity lost. | Manual investigation required. |
| Gateway reset | Both instances restart. Full outage. | Gateway comes back online in 5-10 minutes. |

### Failover Timing

- **BGP hold timer:** Default 90 seconds. Routes withdrawn after 90s of no keepalive.
- **BFD (Bidirectional Forwarding Detection):** If available on the on-prem device, BFD reduces failover detection to sub-second times.
- **DPD (Dead Peer Detection):** Azure sends DPD probes every 45 seconds. Tunnel marked down after missed probes.

## Active-Active VNet-to-VNet

Active-active also applies to VNet-to-VNet connections between two Azure VPN gateways:

```bash
# Gateway in VNet A (already active-active)
# Gateway in VNet B (also active-active)

# Create connections in both directions
az network vpn-connection create \
  --name vnetA-to-vnetB \
  --resource-group <rgA> \
  --vnet-gateway1 <gwA> \
  --vnet-gateway2 <gwB> \
  --shared-key <psk> \
  --enable-bgp true

az network vpn-connection create \
  --name vnetB-to-vnetA \
  --resource-group <rgB> \
  --vnet-gateway1 <gwB> \
  --vnet-gateway2 <gwA> \
  --shared-key <psk> \
  --enable-bgp true
```

This creates four tunnels (2 from each side) for maximum redundancy.

## Converting Existing Gateway to Active-Active

```bash
# Requires a second public IP
az network public-ip create \
  --name <pip2-name> --resource-group <rg> \
  --allocation-method Static --sku Standard

# Update gateway to active-active
az network vnet-gateway update \
  --name <gw-name> \
  --resource-group <rg> \
  --active-active true \
  --public-ip-addresses <pip1-name> <pip2-name>
```

**Warning:** Converting to active-active causes a brief gateway restart. Plan for maintenance window.

## Monitoring Active-Active Gateways

```bash
# Check BGP peer status (both instances should show peers)
az network vnet-gateway list-bgp-peer-status \
  --name <gw-name> \
  --resource-group <rg>

# Check tunnel status for each connection
az network vpn-connection show \
  --name <conn1-name> \
  --resource-group <rg> \
  --query connectionStatus

az network vpn-connection show \
  --name <conn2-name> \
  --resource-group <rg> \
  --query connectionStatus
```

### Azure Monitor Metrics

- **TunnelAverageBandwidth** — per-tunnel bandwidth utilization
- **TunnelEgressBytes / TunnelIngressBytes** — data transferred per tunnel
- **BGPPeerStatus** — BGP session state per peer
- **TunnelEgressPacketDropCount** — packet drops indicating issues

Set up alerts for:
- Tunnel disconnect events
- BGP peer state changes
- Bandwidth threshold breaches

## Additional References

- [Active-active VPN gateways](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-highlyavailable)
- [Configure active-active](https://learn.microsoft.com/azure/vpn-gateway/active-active-portal)
- [BGP with VPN Gateway](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-bgp-overview)
