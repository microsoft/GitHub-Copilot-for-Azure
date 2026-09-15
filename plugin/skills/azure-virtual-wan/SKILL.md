---
name: azure-virtual-wan
description: "Deploy and manage Azure Virtual WAN for managed hub-and-spoke networking at scale, including vWAN hubs, secured virtual hubs with Azure Firewall, routing intent, SD-WAN integration, and NVA-in-hub deployments. WHEN: virtual wan, vwan, virtual WAN hub, hub and spoke, branch connectivity, SD-WAN, secured virtual hub, routing intent, any-to-any routing. DO NOT USE FOR: simple VNet peering (use azure-virtual-network), single-site VPN only (use azure-vpn-gateway), standalone firewall management (use azure-firewall)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Virtual WAN

## When to Use This Skill

- Deploying a managed hub-and-spoke network topology across multiple Azure regions
- Automating branch connectivity using SD-WAN partner integrations
- Enabling any-to-any transit connectivity between branches, VNets, and remote users
- Creating secured virtual hubs with Azure Firewall or third-party security-as-a-service (SECaaS)
- Configuring routing intent and routing policies for centralized traffic inspection
- Deploying network virtual appliances (NVAs) directly into the vWAN hub
- Integrating ExpressRoute circuits into the vWAN hub (see azure-expressroute)
- Setting up S2S VPN, P2S VPN, or ExpressRoute gateways within a vWAN hub
- Migrating from traditional hub-and-spoke with custom routing to vWAN-managed routing
- Connecting multiple on-premises sites across regions with transit routing through Azure backbone

## Rules

1. **Choose the right vWAN type.** Basic vWAN supports S2S VPN only. Standard vWAN supports S2S, P2S, ExpressRoute, inter-hub transit, VNet-to-VNet transit, and NVA-in-hub. Almost always choose Standard.
2. **One hub per region.** Each vWAN can have one hub per Azure region. Hubs automatically mesh for inter-hub transit.
3. **Hub address space cannot overlap.** Hub CIDR must not overlap with connected VNets or on-premises ranges. Minimum /24, recommended /23 for future NVA growth.
4. **Routing intent replaces custom route tables for secured hubs.** When you enable routing intent with Azure Firewall, all private and/or internet traffic routes through the firewall automatically. Do not try to mix routing intent with custom route tables on the same hub.
5. **Secured virtual hub = hub + firewall.** A secured virtual hub is a vWAN hub with Azure Firewall (or SECaaS) deployed inside it, managed through Azure Firewall Manager.
6. **VNet connections are not peerings.** Connecting a VNet to a vWAN hub is a managed connection, not traditional VNet peering. You cannot apply NSGs to the hub side.
7. **NVA-in-hub requires partner support.** Only validated partners (Barracuda, Cisco, Fortinet, VMware, Versa) can deploy NVAs inside the hub. You cannot deploy arbitrary NVAs.
8. **Gateway scale units determine throughput.** S2S VPN: 1 scale unit = 500 Mbps, up to 20 units (10 Gbps). ExpressRoute: 1 scale unit = 2 Gbps, up to 10 units (20 Gbps).
9. **ExpressRoute in vWAN vs standalone.** vWAN ExpressRoute gateways support up to 20 Gbps and auto-connect to the hub routing infrastructure. Standalone gateways require manual UDR configuration.
10. **Migration from hub-and-spoke.** You can migrate existing hub-and-spoke to vWAN but plan for downtime during VNet connection migration. Hub gateway VMs (VPN/ER) in the old hub must be removed first.

## MCP Tools

| Tool | Operation | Purpose |
|------|-----------|---------|
| `azure__network` | `virtual_wan_list` | List all Virtual WANs in a subscription or resource group |

## CLI Fallback

```bash
# List virtual WANs
az network vwan list --resource-group <rg>

# Create a virtual WAN
az network vwan create \
  --name <vwan-name> \
  --resource-group <rg> \
  --type Standard

# Create a virtual hub
az network vhub create \
  --name <hub-name> \
  --resource-group <rg> \
  --vwan <vwan-name> \
  --address-prefix 10.0.0.0/23 \
  --location <region>

# Show virtual hub details
az network vhub show --name <hub-name> --resource-group <rg>

# Connect a VNet to the hub
az network vhub connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --vhub-name <hub-name> \
  --remote-vnet <vnet-resource-id>

# Create S2S VPN gateway in hub
az network vpn-gateway create \
  --name <vpngw-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --scale-unit 1

# Create ExpressRoute gateway in hub
az network express-route gateway create \
  --name <ergw-name> \
  --resource-group <rg> \
  --virtual-hub <hub-name> \
  --min-val 2

# List hub route tables
az network vhub route-table list \
  --resource-group <rg> \
  --vhub-name <hub-name>

# Show effective routes for a connection
az network vhub get-effective-routes \
  --resource-group <rg> \
  --name <hub-name> \
  --resource-type VirtualHubVnetConnection \
  --resource-id <connection-resource-id>

# List VNet connections on a hub
az network vhub connection list \
  --resource-group <rg> \
  --vhub-name <hub-name>
```

## Key Concepts

- **vWAN types:** Basic (S2S VPN only) and Standard (full feature set: S2S, P2S, ER, VNet transit, inter-hub, NVA-in-hub).
- **Virtual hub:** Microsoft-managed VNet in each region acting as the connectivity nexus. Contains gateway VMs, route tables, and optional NVAs or firewalls.
- **Hub routing:** Automatic route propagation across all connections (VNet, VPN, ER). Default route table receives all routes and propagates to all connections.
- **Routing intent:** A policy that directs internet traffic, private traffic, or both through a next-hop security solution (Azure Firewall or NVA) in the hub. Simplifies secured hub routing.
- **Secured virtual hub:** A vWAN hub with Azure Firewall or SECaaS deployed, managed via Firewall Manager. Supports DNAT, network rules, application rules, threat intelligence, and IDPS.
- **Inter-hub transit:** Traffic between hubs in different regions flows over the Microsoft backbone (global vWAN transit). No user configuration needed beyond hub creation.
- **NVA-in-hub:** Deploy supported third-party NVAs (firewalls, SD-WAN controllers) directly inside the hub for in-line traffic inspection or SD-WAN optimization.
- **Scale units:** VPN gateway scale units (500 Mbps each), ExpressRoute gateway scale units (2 Gbps each), P2S gateway scale units (500 Mbps each).
- **Connection types:** VNet connections (spoke VNets), VPN site connections (branches), ExpressRoute connections (circuits), User VPN connections (P2S).
- **SD-WAN integration:** Validated partners can automate branch-to-hub connectivity through the vWAN REST API. Partners include Cisco Viptela, VMware SD-WAN, Versa, and others.

## References

- [references/vwan-architecture.md](references/vwan-architecture.md) — vWAN types, hub components, transit connectivity
- [references/routing-intent.md](references/routing-intent.md) — Routing intent and routing policies
- [references/secured-hub.md](references/secured-hub.md) — Secured virtual hub with Azure Firewall
- [references/nva-in-hub.md](references/nva-in-hub.md) — NVA-in-hub deployment and routing
- [Azure Virtual WAN documentation](https://learn.microsoft.com/azure/virtual-wan/)
- [Virtual WAN FAQ](https://learn.microsoft.com/azure/virtual-wan/virtual-wan-faq)
