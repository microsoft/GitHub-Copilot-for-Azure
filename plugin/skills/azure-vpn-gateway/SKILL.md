---
name: azure-vpn-gateway
description: "Provision and manage Azure VPN Gateways for encrypted hybrid connectivity including site-to-site (S2S), point-to-site (P2S), and VNet-to-VNet tunnels with IPsec/IKE, BGP, and active-active high availability. WHEN: VPN gateway, site-to-site VPN, point-to-site, P2S VPN, S2S VPN, IPsec tunnel, VNet-to-VNet, VPN connection, on-premises VPN, IKE, GatewaySubnet. DO NOT USE FOR: private dedicated connectivity (use azure-expressroute), managed hub-and-spoke (use azure-virtual-wan), DNS-based routing (use azure-traffic-manager)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure VPN Gateway

## When to Use This Skill

- Creating or managing site-to-site (S2S) VPN connections between on-premises networks and Azure VNets
- Configuring point-to-site (P2S) VPN for remote user access to Azure resources
- Setting up VNet-to-VNet encrypted tunnels across regions or subscriptions
- Configuring BGP for dynamic routing over VPN connections
- Designing active-active VPN gateways for high availability
- Selecting VPN Gateway SKUs based on throughput and tunnel count requirements
- Configuring custom IPsec/IKE policies for compliance or interoperability
- Troubleshooting VPN tunnel connectivity, IKE negotiation failures, or throughput issues
- Coexisting VPN Gateway with ExpressRoute on the same VNet (see azure-expressroute)

## Rules

1. **GatewaySubnet is mandatory.** Always create a subnet named exactly `GatewaySubnet` in the VNet before deploying a VPN gateway. Recommended size is /27 or larger.
2. **Route-based is the default recommendation.** Use route-based VPN type for most scenarios. Policy-based VPN is limited to a single S2S tunnel and no P2S support.
3. **SKU determines capacity.** VpnGw1 supports up to 30 S2S tunnels and 250 Mbps benchmark throughput. VpnGw5 supports up to 100 tunnels and 10 Gbps. Always validate SKU limits before committing.
4. **Zone-redundant SKUs for production.** Use VpnGw1AZ through VpnGw5AZ in regions that support availability zones for zone-redundant deployments.
5. **Shared key management.** Never output or log the shared key (PSK) in plaintext. Store in Azure Key Vault and reference securely.
6. **BGP requires unique ASNs.** Azure defaults to ASN 65515. On-premises devices must use a different ASN. Do not use reserved ASNs (0, 65515 in some cases, 4294967295).
7. **Active-active needs two public IPs.** Each gateway instance requires its own public IP address. BGP is mandatory for active-active configurations.
8. **Gateway provisioning takes 30-45 minutes.** Always warn users about deployment time. Do not suggest gateway creation in tight change windows.
9. **Coexistence with ExpressRoute.** VPN and ExpressRoute gateways can coexist on the same VNet using separate GatewaySubnet IPs. VPN acts as failover path.
10. **P2S protocol selection matters.** OpenVPN supports all client OS platforms. IKEv2 is best for macOS. SSTP is Windows-only and limited to TCP 443.

## MCP Tools

| Tool | Operation | Purpose |
|------|-----------|---------|
| `azure__network` | `vpn_gateway_list` | List all VPN gateways in a subscription or resource group |
| `azure__network` | `vpn_connection_list` | List all VPN connections associated with a gateway |

## CLI Fallback

```bash
# List VPN gateways
az network vnet-gateway list --resource-group <rg>

# Show VPN gateway details
az network vnet-gateway show --name <gw-name> --resource-group <rg>

# Create a route-based VPN gateway
az network vnet-gateway create \
  --name <gw-name> \
  --resource-group <rg> \
  --vnet <vnet-name> \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw2AZ \
  --public-ip-addresses <pip-name> \
  --no-wait

# Create a local network gateway (on-prem representation)
az network local-gateway create \
  --name <lgw-name> \
  --resource-group <rg> \
  --gateway-ip-address <on-prem-public-ip> \
  --local-address-prefixes <on-prem-cidr>

# Create S2S VPN connection
az network vpn-connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --vnet-gateway1 <gw-name> \
  --local-gateway2 <lgw-name> \
  --shared-key <psk>

# List VPN connections
az network vpn-connection list --resource-group <rg>

# Show connection status
az network vpn-connection show --name <conn-name> --resource-group <rg>

# Reset a VPN gateway
az network vnet-gateway reset --name <gw-name> --resource-group <rg>

# Download P2S VPN client configuration
az network vnet-gateway vpn-client generate \
  --name <gw-name> \
  --resource-group <rg> \
  --processor-architecture Amd64
```

## Key Concepts

- **VPN types:** Route-based (dynamic routing, supports P2S, multi-site, VNet-to-VNet, coexistence with ExpressRoute) vs Policy-based (static routing, single S2S tunnel only).
- **Gateway SKUs:** VpnGw1 (650 Mbps) → VpnGw2 (1 Gbps) → VpnGw3 (1.25 Gbps) → VpnGw4 (5 Gbps) → VpnGw5 (10 Gbps). AZ variants add zone-redundancy. Basic SKU is legacy — avoid for production.
- **GatewaySubnet:** Dedicated subnet for gateway VMs. /27 recommended, /28 minimum. No NSGs or UDRs on this subnet unless specifically documented.
- **Connection types:** IPsec (S2S to on-prem), Vnet2Vnet (encrypted cross-VNet), ExpressRoute (dedicated circuit gateway binding).
- **BGP:** Border Gateway Protocol for dynamic route exchange. Eliminates static route maintenance. Required for active-active, transit routing, and multi-site with overlapping address spaces.
- **Active-active:** Two gateway instances with two public IPs and two tunnels per on-prem device. Provides automatic failover with minimal downtime.
- **IPsec/IKE:** Phase 1 (IKE SA) establishes secure channel; Phase 2 (IPsec SA) creates the data tunnel. Default parameters work for most scenarios, but custom policies are available for compliance.
- **VPN coexistence with ExpressRoute:** S2S VPN can serve as a backup path when ExpressRoute goes down. Requires both gateway types in the same VNet.
- **NAT rules:** VPN Gateway supports NAT (IngressSnat, EgressSnat) to handle overlapping address spaces between connected networks.

## References

- [references/vpn-types.md](references/vpn-types.md) — VPN types, gateway SKUs, throughput benchmarks
- [references/ipsec-ike-params.md](references/ipsec-ike-params.md) — IPsec/IKE default and custom policy parameters
- [references/s2s-config.md](references/s2s-config.md) — Site-to-site VPN setup checklist and troubleshooting
- [references/p2s-config.md](references/p2s-config.md) — Point-to-site VPN configuration options
- [references/active-active.md](references/active-active.md) — Active-active gateway design and BGP
- [Azure VPN Gateway documentation](https://learn.microsoft.com/azure/vpn-gateway/)
- [VPN Gateway FAQ](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-vpn-faq)
