---
name: azure-expressroute
description: "Provision and manage Azure ExpressRoute circuits for private dedicated connectivity to Azure, including private peering, Microsoft peering, Global Reach, ExpressRoute Direct, and FastPath data-plane acceleration. WHEN: expressroute, express route, private connectivity, dedicated circuit, Microsoft peering, private peering, Global Reach, ExpressRoute Direct, FastPath, hybrid connectivity private. DO NOT USE FOR: VPN over internet (use azure-vpn-gateway), managed hub networking (use azure-virtual-wan for ExpressRoute + vWAN integration)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure ExpressRoute

## When to Use This Skill

- Creating or managing ExpressRoute circuits for private dedicated connectivity to Azure
- Configuring private peering to reach Azure VNets over a dedicated connection
- Setting up Microsoft peering with route filters to access Microsoft 365 and Azure PaaS services
- Connecting two on-premises locations through the Azure backbone via Global Reach
- Deploying ExpressRoute Direct for 10 Gbps or 100 Gbps port-level connectivity
- Enabling FastPath to bypass the ExpressRoute gateway for improved data-path performance
- Selecting circuit bandwidth, SKU tier (Local, Standard, Premium), and metering plan (Metered, Unlimited)
- Troubleshooting circuit provisioning states, BGP peering, or route advertisement issues
- Designing VPN over ExpressRoute or VPN failover alongside ExpressRoute (see azure-vpn-gateway)
- Integrating ExpressRoute with Virtual WAN hubs (see azure-virtual-wan)

## Rules

1. **Circuit requires provider provisioning.** After creating the circuit resource in Azure, the connectivity provider must provision it. Circuit stays in `NotProvisioned` state until the provider completes layer 2 setup.
2. **ExpressRoute Direct skips the provider.** With ExpressRoute Direct, you own the physical port pair and can create circuits on it directly. Available in 10 Gbps and 100 Gbps.
3. **Private peering for VNets.** Use private peering to reach resources in Azure VNets. Requires a /30 or /126 subnet pair for primary and secondary BGP sessions.
4. **Microsoft peering for PaaS/M365.** Route filters are mandatory for Microsoft peering — you must explicitly select which service communities to advertise.
5. **Premium add-on for cross-geo.** Standard circuits connect to regions within the same geopolitical boundary. Enable Premium for global VNet linking and increased route limits (10,000 routes vs 4,000).
6. **Local SKU for same-metro.** If your peering location is in the same metro as your Azure region, use Local SKU for unlimited egress at no data transfer cost.
7. **Gateway is still required.** Even with ExpressRoute, you need an ExpressRoute gateway in the VNet to terminate the connection. FastPath can bypass it for data traffic but gateway is still needed for control plane.
8. **Redundancy is built-in.** Every circuit has two connections (primary and secondary) for built-in redundancy. Design on-prem connectivity to use both paths.
9. **BGP ASN restrictions.** Azure uses ASN 12076 for ExpressRoute peering. Do not use ASN 12076, 65515, or 65520 on on-premises routers.
10. **Deprovisioning order matters.** Remove all VNet connections first, then delete peerings, then deprovision the circuit. Deleting out of order causes orphaned resources.

## MCP Tools

| Tool | Operation | Purpose |
|------|-----------|---------|
| `azure__network` | `expressroute_circuit_list` | List all ExpressRoute circuits in a subscription or resource group |
| `azure__network` | `expressroute_circuit_get` | Get detailed configuration of a specific ExpressRoute circuit |

## CLI Fallback

```bash
# List ExpressRoute circuits
az network express-route list --resource-group <rg>

# Show circuit details and provisioning state
az network express-route show --name <circuit-name> --resource-group <rg>

# Create an ExpressRoute circuit
az network express-route create \
  --name <circuit-name> \
  --resource-group <rg> \
  --provider <provider-name> \
  --peering-location <location> \
  --bandwidth 1000 \
  --sku-tier Standard \
  --sku-family MeteredData

# Create private peering
az network express-route peering create \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --peering-type AzurePrivatePeering \
  --peer-asn <on-prem-asn> \
  --primary-peer-subnet <primary-/30> \
  --secondary-peer-subnet <secondary-/30> \
  --vlan-id <vlan>

# Create Microsoft peering
az network express-route peering create \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --peering-type MicrosoftPeering \
  --peer-asn <on-prem-asn> \
  --primary-peer-subnet <primary-/30> \
  --secondary-peer-subnet <secondary-/30> \
  --vlan-id <vlan> \
  --advertised-public-prefixes <public-prefix>

# List peerings on a circuit
az network express-route peering list \
  --circuit-name <circuit-name> \
  --resource-group <rg>

# Create ExpressRoute gateway
az network vnet-gateway create \
  --name <ergw-name> \
  --resource-group <rg> \
  --vnet <vnet-name> \
  --gateway-type ExpressRoute \
  --sku ErGw2AZ

# Connect circuit to VNet gateway
az network vpn-connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --vnet-gateway1 <ergw-name> \
  --express-route-circuit2 <circuit-resource-id>

# Show BGP peering status
az network express-route peering show \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --name AzurePrivatePeering
```

## Key Concepts

- **Circuit states:** ServiceProviderProvisioningState cycles through `NotProvisioned` → `Provisioning` → `Provisioned`. CircuitProvisioningState must be `Succeeded`.
- **SKU tiers:** Local (same-metro, free egress), Standard (same geopolitical region, 4000 routes), Premium (global, 10000 routes, more VNet links).
- **Peering types:** AzurePrivatePeering (VNet access), MicrosoftPeering (Microsoft 365, Azure PaaS via public IPs). Azure public peering is deprecated.
- **Gateway SKUs:** ErGw1Az (1 Gbps), ErGw2Az (2 Gbps), ErGw3Az (10 Gbps), ErGwScale (per-unit scaling). Ultra Performance enables FastPath.
- **FastPath:** Bypasses the ExpressRoute gateway in the data path for improved latency. Requires ErGw3Az or Ultra Performance gateway. Does not support VNet peering or UDR scenarios in all cases.
- **Global Reach:** Connects two on-premises sites through the Microsoft backbone via their respective ExpressRoute circuits. No need for a VPN tunnel between sites.
- **ExpressRoute Direct:** Physical port pairs (10G or 100G) at peering locations. Supports MACsec encryption on the ports. Create multiple circuits on one port pair.
- **BFD (Bidirectional Forwarding Detection):** Supported on private peering for sub-second failover detection.
- **Route limits:** Standard = 4,000 routes per peering. Premium = 10,000 routes per peering. Exceeding limits causes BGP session drops.
- **Coexistence with VPN:** ExpressRoute and VPN Gateway can coexist on the same VNet for VPN-as-failover scenarios (see azure-vpn-gateway).

## References

- [references/circuit-provisioning.md](references/circuit-provisioning.md) — Circuit creation, bandwidth, SKU tiers, provider workflow
- [references/peering-config.md](references/peering-config.md) — Private and Microsoft peering configuration
- [references/global-reach.md](references/global-reach.md) — Global Reach setup and supported regions
- [references/fastpath.md](references/fastpath.md) — FastPath configuration and limitations
- [Azure ExpressRoute documentation](https://learn.microsoft.com/azure/expressroute/)
- [ExpressRoute FAQ](https://learn.microsoft.com/azure/expressroute/expressroute-faqs)
