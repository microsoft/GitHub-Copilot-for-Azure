# Routing Intent and Routing Policies

## Overview

Routing intent is a feature that simplifies traffic routing through a next-hop security solution (Azure Firewall or supported NVA) in a Virtual WAN hub. Instead of manually configuring route tables and static routes, routing intent automatically programs the hub to send internet traffic, private traffic, or both through the security solution.

## Key Concepts

### Routing Policies

Routing intent supports two routing policies that can be enabled independently or together:

| Policy | Traffic Affected | Next Hop |
|--------|-----------------|----------|
| **Internet Traffic** | Traffic destined for the internet (0.0.0.0/0) | Azure Firewall or NVA in the hub |
| **Private Traffic** | Traffic between VNets, branches, and other private ranges (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) | Azure Firewall or NVA in the hub |

### Traffic Flows with Routing Intent

When **both** policies are enabled:

| Source → Destination | Path |
|---------------------|------|
| VNet → Internet | VNet → Hub Firewall → Internet |
| VNet → VNet (same hub) | VNet A → Hub Firewall → VNet B |
| VNet → VNet (different hub) | VNet A → Hub 1 Firewall → Hub 2 Firewall → VNet B |
| VNet → Branch (VPN/ER) | VNet → Hub Firewall → Branch |
| Branch → VNet | Branch → Hub Firewall → VNet |
| Branch → Internet | Branch → Hub Firewall → Internet |
| Branch → Branch | Branch A → Hub Firewall → Branch B |

All traffic inspected. No exceptions within the scope of enabled policies.

When only **Internet Traffic** policy is enabled:
- Only 0.0.0.0/0 traffic goes through the firewall
- Private traffic (VNet-to-VNet, VNet-to-branch) routes directly without firewall inspection

When only **Private Traffic** policy is enabled:
- Private traffic goes through the firewall
- Internet traffic follows default routing (breakout at the branch or VNet level)

## Prerequisites

- **Standard vWAN** (Basic does not support routing intent)
- **Azure Firewall** or **supported NVA** deployed in the hub (secured virtual hub)
- Routing intent **replaces** custom route tables when enabled — you cannot use both simultaneously on the same hub
- All spoke VNets connected to the hub must be associated with the default route table

## Configuration

### Enable Routing Intent with Azure Firewall

First, deploy Azure Firewall in the hub (creating a secured virtual hub — see [references/secured-hub.md](secured-hub.md)).

Then enable routing intent via Azure portal or CLI:

```bash
# Enable both internet and private traffic routing through Azure Firewall
az network vhub routing-intent create \
  --name <intent-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --routing-policies "[{name:InternetTraffic,destinations:[Internet],nextHop:<firewall-resource-id>},{name:PrivateTraffic,destinations:[PrivateTraffic],nextHop:<firewall-resource-id>}]"
```

### Enable Only Internet Traffic Policy

```bash
az network vhub routing-intent create \
  --name <intent-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --routing-policies "[{name:InternetTraffic,destinations:[Internet],nextHop:<firewall-resource-id>}]"
```

### Enable Only Private Traffic Policy

```bash
az network vhub routing-intent create \
  --name <intent-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --routing-policies "[{name:PrivateTraffic,destinations:[PrivateTraffic],nextHop:<firewall-resource-id>}]"
```

### View Routing Intent Configuration

```bash
az network vhub routing-intent show \
  --name <intent-name> \
  --resource-group <rg> \
  --vhub <hub-name>
```

### Update Routing Policies

```bash
# Add private traffic policy to existing internet-only intent
az network vhub routing-intent update \
  --name <intent-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --routing-policies "[{name:InternetTraffic,destinations:[Internet],nextHop:<firewall-resource-id>},{name:PrivateTraffic,destinations:[PrivateTraffic],nextHop:<firewall-resource-id>}]"
```

### Remove Routing Intent

```bash
az network vhub routing-intent delete \
  --name <intent-name> \
  --resource-group <rg> \
  --vhub <hub-name>
```

**Warning:** Removing routing intent removes automatic routing through the firewall. Traffic reverts to default vWAN routing (direct connectivity).

## Inter-Hub Behavior

When routing intent is enabled on **multiple hubs**:

- Inter-hub private traffic is inspected by **both hub firewalls** (firewall in source hub and firewall in destination hub)
- This provides double inspection but may increase latency
- Each firewall applies its own policy set

When routing intent is enabled on **one hub only**:

- Traffic from the secured hub's spokes is inspected by that hub's firewall
- Traffic from the non-secured hub's spokes is not inspected (no firewall in that hub)
- For consistent security, enable routing intent on all hubs

## Interaction with Custom Route Tables

**Routing intent and custom route tables are mutually exclusive on the same hub.**

When routing intent is enabled:
- All existing custom route table associations are overridden
- All connections are automatically associated with the default route table
- Static routes in custom route tables are not honored
- You manage security policy through the firewall (not route tables)

If you need custom route table behavior (e.g., VNet isolation), you must disable routing intent and configure routing manually.

## Interaction with VNet Connection Settings

### Internet Security Flag

For internet traffic policy, each VNet connection has an "Internet Security" flag:

```bash
# Enable internet security for a VNet connection (routes internet traffic through firewall)
az network vhub connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --vhub-name <hub-name> \
  --internet-security true
```

When routing intent with internet policy is enabled, this flag is automatically set to `true` for all connections.

### Propagating Default Route

When internet traffic policy is enabled, the hub automatically advertises a default route (0.0.0.0/0) to:
- All connected VNets (via VNet connection)
- All VPN sites (via BGP)
- All ExpressRoute connected sites (via BGP, if configured)

This forces all internet-bound traffic through the hub firewall.

## Troubleshooting

### Traffic Not Flowing Through Firewall

1. **Verify routing intent is enabled** — check `az network vhub routing-intent show`
2. **Check firewall status** — Azure Firewall must be running and healthy
3. **Check firewall rules** — traffic may be blocked by the firewall (not a routing issue)
4. **Verify effective routes** — `az network vhub get-effective-routes` should show the firewall as next hop
5. **VNet connection association** — all connections must be in the default route table

### Internet Access Broken After Enabling Internet Policy

1. **Firewall rules needed** — you must create firewall rules to allow internet traffic (DNAT, network, application rules)
2. **DNS configuration** — VNets may need Azure Firewall's private IP as their DNS server for FQDN-based rules
3. **Asymmetric routing** — ensure return traffic from the internet flows back through the firewall

### Private Connectivity Broken After Enabling Private Policy

1. **Firewall rules** — create network rules to allow VNet-to-VNet and VNet-to-branch traffic
2. **Check RFC 1918 coverage** — routing intent covers 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
3. **Non-RFC 1918 private ranges** — if using other private ranges, they may not be covered by the private traffic policy

## Additional References

- [Virtual WAN routing intent](https://learn.microsoft.com/azure/virtual-wan/how-to-routing-policies)
- [Routing intent concepts](https://learn.microsoft.com/azure/virtual-wan/routing-intent-concepts)
- [Routing intent FAQ](https://learn.microsoft.com/azure/virtual-wan/routing-intent-faq)
