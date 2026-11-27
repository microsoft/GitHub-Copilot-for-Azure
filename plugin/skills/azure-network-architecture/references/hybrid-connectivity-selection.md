# Hybrid Connectivity Selection Guide

Choose between VPN Gateway, ExpressRoute, and Virtual WAN for connecting on-premises networks to Azure. Includes decision criteria, coexistence patterns, and migration paths.

## Decision Criteria

| Factor | VPN Gateway | ExpressRoute | Virtual WAN |
|--------|:-----------:|:------------:|:-----------:|
| **Connection type** | Encrypted tunnel over internet | Private dedicated link | Managed hub with VPN + ER |
| **Bandwidth** | Up to 10 Gbps (VpnGw5) | 50 Mbps – 100 Gbps | Aggregate of VPN + ER |
| **Latency** | Variable (internet-dependent) | Low and predictable | Low (ER) or variable (VPN) |
| **SLA** | 99.9% (active-active) or 99.95% (AZ) | 99.95% (single circuit) | 99.95% |
| **Encryption** | IPsec built-in | Not encrypted by default | IPsec for VPN; MACsec for ER Direct |
| **Setup time** | Minutes to hours | Weeks (provider provisioning) | Hours (managed deployment) |
| **Cost** | Low ($150-2,500/month gateway) | Medium-High ($200-12,000/month circuit + gateway) | Medium (hub fee + connections) |
| **Redundancy** | Active-active tunnels | Dual circuits recommended | Built-in HA for VPN and ER |
| **Max sites** | 30-100 S2S tunnels | Per circuit limits | 1,000+ branches |

## Quick Decision Guide

```
Do you need > 1 Gbps bandwidth?
├── YES → Do you need predictable latency?
│         ├── YES → ExpressRoute
│         └── NO  → VPN Gateway (VpnGw4/5) or ExpressRoute
└── NO  → Is this a production workload?
          ├── YES → Is cost the primary concern?
          │         ├── YES → VPN Gateway
          │         └── NO  → ExpressRoute (for reliability)
          └── NO  → VPN Gateway

Do you have 10+ branch offices?
├── YES → Virtual WAN (managed branch connectivity)
└── NO  → VPN Gateway or ExpressRoute (with hub VNet)

Do you need connectivity from multiple locations?
├── YES → Is it branch offices with SD-WAN?
│         ├── YES → Virtual WAN
│         └── NO  → ExpressRoute with multiple peering locations
└── NO  → VPN Gateway (single site)
```

## VPN Gateway

### When to choose VPN Gateway

- **Budget-constrained** — lowest entry cost for hybrid connectivity
- **Quick setup needed** — can be operational in hours, not weeks
- **Internet-quality latency is acceptable** — suitable for non-real-time workloads
- **Encryption required** — IPsec encryption is built-in
- **Backup connectivity** — commonly paired with ExpressRoute as a failover path
- **Point-to-site** — need remote user VPN access to Azure VNets

### VPN Gateway SKU comparison

| SKU | S2S Tunnels | P2S Connections | Throughput | AZ Support | Price (approx) |
|-----|:-----------:|:---------------:|:----------:|:----------:|:--------------:|
| VpnGw1 | 30 | 250 | 650 Mbps | VpnGw1AZ | ~$150/month |
| VpnGw2 | 30 | 500 | 1 Gbps | VpnGw2AZ | ~$350/month |
| VpnGw3 | 30 | 1,000 | 1.25 Gbps | VpnGw3AZ | ~$700/month |
| VpnGw4 | 100 | 5,000 | 5 Gbps | VpnGw4AZ | ~$1,250/month |
| VpnGw5 | 100 | 10,000 | 10 Gbps | VpnGw5AZ | ~$2,500/month |

```bash
# Create VPN Gateway (zone-redundant)
az network vnet-gateway create \
  -g <rg> \
  -n vpn-gateway \
  --vnet <hub-vnet> \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw2AZ \
  --generation Generation2 \
  --location <region>

# Create site-to-site connection
az network vpn-connection create \
  -g <rg> \
  -n onprem-connection \
  --vnet-gateway1 vpn-gateway \
  --local-gateway2 onprem-lng \
  --shared-key <pre-shared-key> \
  --enable-bgp
```

### VPN active-active for high availability

```bash
# Create VPN Gateway with active-active (two tunnels, two public IPs)
az network vnet-gateway create \
  -g <rg> \
  -n vpn-gateway \
  --vnet <hub-vnet> \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw2AZ \
  --active-active \
  --public-ip-addresses pip1 pip2
```

## ExpressRoute

### When to choose ExpressRoute

- **Predictable, low latency required** — financial trading, real-time applications
- **High bandwidth needed** — data migration, database replication, backup
- **SLA-backed connectivity** — 99.95% uptime with provider SLA stacked on top
- **Accessing Microsoft 365 and Dynamics** (with Microsoft peering)
- **Regulatory requirements** — traffic never traverses the public internet
- **Large-scale data transfer** — avoid internet egress charges

### ExpressRoute circuit options

| Option | Bandwidth | Use Case |
|--------|-----------|----------|
| Standard circuit | 50 Mbps – 10 Gbps | Single Azure region connectivity |
| Premium circuit | 50 Mbps – 10 Gbps | Multi-region, global reach, more route prefixes |
| ExpressRoute Direct | 10 Gbps or 100 Gbps | Dedicated port, MACsec encryption, massive bandwidth |
| ExpressRoute Local | Up to 10 Gbps | Discounted when near an ExpressRoute peering location |

### ExpressRoute peering types

| Peering Type | Connects To | Route Prefixes |
|-------------|-------------|---------------|
| Azure Private Peering | Azure VNets (private IPs) | VNet address spaces |
| Microsoft Peering | Microsoft 365, Dynamics 365, Azure PaaS (public IPs) | Microsoft service IPs |

```bash
# Create ExpressRoute circuit
az network express-route create \
  -g <rg> \
  -n er-circuit \
  --bandwidth 1000 \
  --peering-location "Silicon Valley" \
  --provider "Equinix" \
  --sku-family MeteredData \
  --sku-tier Premium

# Create ExpressRoute Gateway
az network vnet-gateway create \
  -g <rg> \
  -n er-gateway \
  --vnet <hub-vnet> \
  --gateway-type ExpressRoute \
  --sku ErGw2AZ \
  --location <region>

# Connect circuit to gateway
az network vpn-connection create \
  -g <rg> \
  -n er-connection \
  --vnet-gateway1 er-gateway \
  --express-route-circuit2 <circuit-id>
```

### ExpressRoute redundancy best practices

- **Two circuits from different peering locations** — protects against single provider/location failure
- **ExpressRoute + VPN failover** — VPN as backup when ExpressRoute is down
- **ExpressRoute Global Reach** — connect on-premises sites through Microsoft backbone

## Virtual WAN

### When to choose Virtual WAN

- **Many branch offices** (10+) with SD-WAN integration
- **Want managed routing** — no manual UDRs or peering configuration
- **Need hub transit** — spoke-to-spoke, VPN-to-ExpressRoute transit
- **Multi-region deployment** — global transit network with interconnected hubs
- **Rapid deployment** — automated hub provisioning

### Virtual WAN vs hub VNet

| Feature | Virtual WAN | Hub VNet |
|---------|:-----------:|:--------:|
| Spoke-to-spoke routing | Automatic | Manual (UDR + NVA) |
| VPN-to-ER transit | Built-in | Manual configuration |
| Branch SD-WAN integration | 60+ partners | Manual |
| NVA in hub | Limited partners | Full control |
| Custom routing tables | Yes (labels + route tables) | Full UDR control |
| Management overhead | Lower | Higher |
| Cost | Hub fee + routing | Individual resource costs |

```bash
# Create Virtual WAN
az network vwan create -g <rg> -n enterprise-vwan --type Standard

# Create hub
az network vhub create \
  -g <rg> \
  -n hub-eastus \
  --vwan enterprise-vwan \
  --address-prefix 10.0.0.0/23 \
  --location eastus

# Add VPN Gateway to hub
az network vpn-gateway create \
  -g <rg> \
  -n hub-vpn-gw \
  --vhub hub-eastus \
  --location eastus

# Connect a spoke VNet
az network vhub connection create \
  -g <rg> \
  --vhub-name hub-eastus \
  -n spoke1-connection \
  --remote-vnet <spoke-vnet-id>
```

## Coexistence Patterns

### Pattern 1: ExpressRoute + VPN Backup

Use ExpressRoute as primary with VPN Gateway as failover. The VPN tunnel activates automatically when ExpressRoute goes down.

```bash
# Both gateways in the same GatewaySubnet
# ExpressRoute gateway
az network vnet-gateway create -g <rg> -n er-gw --vnet hub-vnet --gateway-type ExpressRoute --sku ErGw2AZ

# VPN gateway (separate public IPs, same subnet)
az network vnet-gateway create -g <rg> -n vpn-gw --vnet hub-vnet --gateway-type Vpn --sku VpnGw2AZ
```

**Routing behavior:** ExpressRoute routes (BGP) have higher preference. When ER goes down, VPN routes take over. When ER recovers, traffic shifts back automatically.

### Pattern 2: ExpressRoute for Production + VPN for Dev/Test

Separate connectivity for different environments:
- ExpressRoute → Hub VNet → Production spokes
- VPN Gateway → Separate VNet → Dev/Test spokes

### Pattern 3: Dual ExpressRoute Circuits

Maximum redundancy with two circuits from different providers and peering locations:

```
On-premises ──── ER Circuit 1 (Provider A, Location 1) ──── Azure Hub
On-premises ──── ER Circuit 2 (Provider B, Location 2) ──── Azure Hub
```

Both circuits connect to the same ExpressRoute gateway. BGP distributes traffic across both. If one fails, the other carries all traffic.

## Migration Paths

### VPN → ExpressRoute

1. Deploy ExpressRoute circuit and gateway alongside existing VPN
2. Configure ExpressRoute private peering
3. Both connections active — ER preferred due to BGP weight
4. Verify all traffic flows over ExpressRoute
5. Decommission VPN (or keep as backup)

### Hub VNet → Virtual WAN

1. Deploy Virtual WAN and hub in the same region
2. Connect spoke VNets to Virtual WAN hub
3. Migrate VPN/ER connections to Virtual WAN hub gateways
4. Update DNS and on-premises routing
5. Remove peering to old hub VNet
6. Decommission old hub VNet

### Single Region → Multi-Region

1. Deploy second hub (VNet or Virtual WAN hub) in the secondary region
2. Peer hubs (global VNet peering) or connect via Virtual WAN
3. Deploy secondary ExpressRoute circuit at a different peering location
4. Configure geo-redundant VPN if using VPN
5. Set up DNS failover and routing policies

## Cost Optimization Tips

- **VPN Gateway:** Use `VpnGw1AZ` for dev/test, scale up only for production
- **ExpressRoute:** Use metered billing if data transfer is low; unlimited for heavy transfer
- **ExpressRoute Local:** Up to 70% discount if your datacenter is near the peering location
- **Virtual WAN:** Only deploy routing infrastructure in regions where you have spokes
- **Reserved capacity:** Commit to 1-year or 3-year reserved pricing for ExpressRoute circuits

## Related Resources

- [VPN Gateway overview](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpngateways)
- [ExpressRoute overview](https://learn.microsoft.com/azure/expressroute/expressroute-introduction)
- [Virtual WAN overview](https://learn.microsoft.com/azure/virtual-wan/virtual-wan-about)
- [ExpressRoute + VPN coexistence](https://learn.microsoft.com/azure/expressroute/expressroute-howto-coexist-resource-manager)
- For VPN configuration → use `azure-vpn-gateway` skill
- For ExpressRoute configuration → use `azure-expressroute` skill
- For Virtual WAN configuration → use `azure-virtual-wan` skill
