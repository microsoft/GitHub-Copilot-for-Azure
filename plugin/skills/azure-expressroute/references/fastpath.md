# ExpressRoute FastPath

## Overview

FastPath is a data-path optimization feature that bypasses the ExpressRoute virtual network gateway for traffic flowing between on-premises and Azure VNets. With FastPath, data-plane traffic is sent directly to VMs in the VNet, reducing latency and improving throughput.

**Without FastPath:**
```
On-Prem → ExpressRoute Circuit → ExpressRoute Gateway → VNet (VMs)
```

**With FastPath:**
```
On-Prem → ExpressRoute Circuit → VNet (VMs) directly
                                   ↑
                    ExpressRoute Gateway still handles control plane
```

The gateway is still required for control-plane operations (route exchange, connection management) but data-plane packets skip it.

## When to Use FastPath

- Latency-sensitive workloads where even the gateway hop adds noticeable delay
- High-throughput data transfers exceeding the gateway SKU's maximum bandwidth
- Applications requiring consistent low-latency connectivity (financial trading, real-time databases)
- Workloads currently bottlenecked by the ER gateway's throughput limits

## Requirements

### Gateway SKU Requirements

FastPath is only available on high-performance gateway SKUs:

| Gateway SKU | FastPath Support |
|-------------|-----------------|
| ErGw1Az | No |
| ErGw2Az | No |
| ErGw3Az | Yes |
| Ultra Performance (ErGw3Az equivalent) | Yes |
| ErGwScale (2+ scale units) | Yes |

If you are on ErGw1Az or ErGw2Az, you must upgrade the gateway before enabling FastPath.

### Circuit Requirements

- ExpressRoute circuit must be in **Provisioned** state with active private peering
- Works with both provider-based circuits and ExpressRoute Direct circuits
- No specific circuit bandwidth requirement — FastPath works on any bandwidth

## Enabling FastPath

FastPath is enabled on the **connection** between the ER gateway and the circuit, not on the gateway itself.

```bash
# Enable FastPath on an existing connection
az network vpn-connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --express-route-gateway-bypass true

# Create a new connection with FastPath enabled
az network vpn-connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --vnet-gateway1 <ergw-name> \
  --express-route-circuit2 <circuit-resource-id> \
  --express-route-gateway-bypass true
```

### Verify FastPath Status

```bash
az network vpn-connection show \
  --name <conn-name> \
  --resource-group <rg> \
  --query "{name:name, fastPath:expressRouteGatewayBypass, status:connectionStatus}"
```

## Supported Scenarios

FastPath works with the following configurations:

| Scenario | Supported |
|----------|-----------|
| Direct VM connectivity in the VNet | Yes |
| Private endpoints in the VNet | Yes (with certain configurations) |
| VNet peering — remote VNet VMs | Yes (with ErGwScale 2+ units or updated ErGw3Az) |
| Load Balancer (Standard) in the VNet | Yes |
| VNet with Azure Firewall/NVA in-path via UDR | Limited — see Limitations |

## Limitations

FastPath has several important limitations to understand before enabling:

### VNet Peering

- FastPath with VNet peering is supported on **ErGwScale (2+ scale units)** and updated ErGw3Az gateways
- Older ErGw3Az deployments may not support FastPath to peered VNets
- Traffic to peered VNets may fall back to the gateway path if FastPath does not support the specific peering configuration

### User-Defined Routes (UDRs)

- **UDRs on the GatewaySubnet** are not evaluated by FastPath traffic (traffic bypasses the gateway)
- UDRs on **VM subnets** directing traffic to an NVA are respected for traffic originating from the VM, but inbound FastPath traffic may bypass the NVA
- If you need to force all inbound traffic through an NVA (e.g., Azure Firewall), FastPath may not be appropriate

### Private Endpoints

- FastPath to private endpoints is supported with **ErGwScale** or **ErGw3Az** in updated regions
- Check current documentation for the latest support status

### DNS Private Resolver

- FastPath traffic to DNS Private Resolver inbound endpoints follows the gateway path (not bypassed)

### Basic Load Balancer

- FastPath does not work with Basic Load Balancer — use Standard Load Balancer

### Forced Tunneling

- If the VNet has forced tunneling configured (default route 0.0.0.0/0 pointing to an NVA), FastPath bypasses the forced tunnel for inbound ExpressRoute traffic

## Performance Comparison

| Metric | Without FastPath | With FastPath |
|--------|-----------------|---------------|
| Latency (additional hop) | 1-2 ms (gateway hop) | ~0 ms (bypassed) |
| Throughput cap | Gateway SKU limit (1-40 Gbps) | Circuit bandwidth |
| Control plane | Through gateway | Through gateway |
| Data plane | Through gateway | Direct to VNet |

### When FastPath Does NOT Improve Performance

- If your bottleneck is the ExpressRoute circuit bandwidth (not the gateway)
- If traffic patterns are bursty and the gateway is not saturated
- If you need NVA/Firewall inspection of all inbound traffic (FastPath bypasses this)

## Disabling FastPath

```bash
az network vpn-connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --express-route-gateway-bypass false
```

Traffic immediately falls back to the gateway path. No downtime expected but brief reconvergence may occur.

## Troubleshooting

### FastPath Enabled but No Performance Improvement

1. **Verify gateway SKU** — must be ErGw3Az, Ultra Performance, or ErGwScale with 2+ units
2. **Check connection status** — connection must be `Connected` with `expressRouteGatewayBypass: true`
3. **VNet peering fallback** — if traffic targets a peered VNet, FastPath may not apply on older gateways
4. **UDR interference** — check if UDRs on VM subnets are redirecting traffic through an NVA
5. **Latency testing** — use Azure Network Watcher or `traceroute` to confirm the gateway hop is bypassed

### Traffic Still Flowing Through Gateway

1. **Control plane traffic always flows through the gateway** — only data-plane traffic is bypassed
2. **Unsupported scenarios** fall back to the gateway (e.g., Basic LB, DNS Private Resolver)
3. **Check feature registration** — some subscriptions may require feature flag registration for FastPath

## Integration with Other Azure Services

### FastPath and Azure Virtual WAN

For vWAN, FastPath is not configured the same way. vWAN ExpressRoute gateways have their own FastPath behavior managed through the hub configuration (see azure-virtual-wan).

### FastPath and VPN Coexistence

When VPN and ER gateways coexist on the same VNet, FastPath applies only to ExpressRoute traffic. VPN traffic continues to flow through the VPN gateway normally.

## Additional References

- [About ExpressRoute FastPath](https://learn.microsoft.com/azure/expressroute/about-fastpath)
- [Configure FastPath](https://learn.microsoft.com/azure/expressroute/expressroute-howto-linkvnet-arm#configure-expressroute-fastpath)
- [ExpressRoute gateway SKUs](https://learn.microsoft.com/azure/expressroute/expressroute-about-virtual-network-gateways)
