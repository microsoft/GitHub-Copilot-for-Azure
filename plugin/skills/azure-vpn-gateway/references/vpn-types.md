# VPN Types and Gateway SKUs

## Policy-Based vs Route-Based VPN

Azure VPN Gateway supports two VPN types that determine how traffic selectors are constructed and how tunnels are established.

### Policy-Based VPN (IKEv1)

- Uses **traffic selectors** (source/destination IP prefix pairs) to determine which traffic enters the tunnel
- Supports **one S2S tunnel only** per gateway
- Does **not** support point-to-site (P2S) connections
- Does **not** support VNet-to-VNet connections
- Does **not** support coexistence with ExpressRoute
- Does **not** support BGP
- Limited to IKEv1
- Available only on **Basic** SKU
- Use case: legacy on-premises devices that require policy-based IPsec

### Route-Based VPN (IKEv2)

- Uses an **any-to-any** (wildcard) traffic selector and routing tables to direct traffic
- Supports **multiple S2S tunnels** (count depends on SKU)
- Supports **P2S connections** (OpenVPN, IKEv2, SSTP)
- Supports **VNet-to-VNet** connections
- Supports **coexistence with ExpressRoute** gateway on the same VNet
- Supports **BGP** dynamic routing
- Supports **active-active** configuration
- Supports **custom IPsec/IKE policies**
- Recommended for virtually all scenarios

## Gateway SKU Comparison

| SKU | Max S2S Tunnels | Max P2S Connections | Aggregate Throughput Benchmark | BGP | AZ Support |
|-----|-----------------|---------------------|-------------------------------|-----|------------|
| Basic | 10 | 128 | 100 Mbps | No | No |
| VpnGw1 | 30 | 250 | 650 Mbps | Yes | No |
| VpnGw2 | 30 | 500 | 1 Gbps | Yes | No |
| VpnGw3 | 30 | 1,000 | 1.25 Gbps | Yes | No |
| VpnGw4 | 100 | 5,000 | 5 Gbps | Yes | No |
| VpnGw5 | 100 | 10,000 | 10 Gbps | Yes | No |
| VpnGw1AZ | 30 | 250 | 650 Mbps | Yes | Yes |
| VpnGw2AZ | 30 | 500 | 1 Gbps | Yes | Yes |
| VpnGw3AZ | 30 | 1,000 | 1.25 Gbps | Yes | Yes |
| VpnGw4AZ | 100 | 5,000 | 5 Gbps | Yes | Yes |
| VpnGw5AZ | 100 | 10,000 | 10 Gbps | Yes | Yes |

### SKU Selection Guidance

1. **Avoid Basic SKU** for production. It lacks BGP, zone-redundancy, and active-active support. It is a legacy SKU.
2. **Use AZ SKUs in production.** VpnGw1AZ through VpnGw5AZ provide zone-redundant deployments. If the region supports availability zones, always use AZ variants.
3. **Start with VpnGw2AZ** for most production workloads. It provides 1 Gbps throughput, supports up to 30 tunnels, and allows in-place upgrade to VpnGw3AZ/4AZ/5AZ without redeployment.
4. **VpnGw4AZ or VpnGw5AZ** for large enterprises with 30+ branches or high aggregate throughput requirements.
5. **Throughput benchmarks are aggregates**, not per-tunnel guarantees. A VpnGw2 (1 Gbps) gateway with 10 tunnels shares the 1 Gbps across all tunnels.

### In-Place SKU Resize

You can resize within a generation without redeployment:
- VpnGw1 ↔ VpnGw2 ↔ VpnGw3 ↔ VpnGw4 ↔ VpnGw5 (same for AZ variants)
- You **cannot** resize from Basic to VpnGw SKUs (requires redeployment)
- You **cannot** resize from non-AZ to AZ variants (requires redeployment)

```bash
# Resize a VPN gateway SKU (no downtime for resize within generation)
az network vnet-gateway update \
  --name <gw-name> \
  --resource-group <rg> \
  --sku VpnGw3AZ
```

## Throughput Benchmarks and Real-World Expectations

Azure publishes aggregate throughput benchmarks per SKU. Actual throughput depends on:

- **Number of tunnels** sharing the gateway
- **Packet size** — small packets (64B) significantly reduce throughput vs large packets (1400B)
- **Encryption algorithm** — AES-256-GCM is faster than AES-256-CBC on the gateway hardware
- **Latency to on-prem** — higher RTT reduces TCP throughput over the tunnel
- **Single tunnel limit** — a single IPsec tunnel typically maxes out at approximately 1-1.25 Gbps regardless of SKU

### Practical guidance

- If you need more than 1 Gbps to a single site, configure **active-active** with BGP to establish 2-4 tunnels and load-balance using ECMP
- For throughput testing, use tools like `iperf3` with multiple parallel streams and large window sizes
- Monitor gateway metrics: `TunnelBandwidth`, `TunnelEgressBytes`, `TunnelIngressBytes` in Azure Monitor

## VPN Gateway Deployment Time

- Gateway creation typically takes **30-45 minutes**
- SKU resizing takes **approximately 30 minutes**
- Gateway reset takes **5-10 minutes** (resets active connections)
- Plan change windows accordingly

## Additional References

- [About VPN Gateway SKUs](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpn-gateway-settings#gwsku)
- [VPN Gateway FAQ](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-vpn-faq)
- [Validated VPN devices](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpn-devices)
