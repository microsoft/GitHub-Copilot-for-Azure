# User-Defined Routes (UDR) Guide

## Overview

User-defined routes (UDRs) allow you to override Azure's default system routes, giving you fine-grained control over how network traffic is routed within and between subnets. UDRs are stored in route tables, which are then associated with one or more subnets.

Every Azure subnet has a set of system routes that handle default traffic flows (intra-VNet, to the internet, to peered VNets, etc.). UDRs let you override these defaults — for example, to force all internet-bound traffic through a firewall instead of going directly to the internet.

## When to Use UDRs

- **Force tunneling**: Route all internet traffic through an on-premises firewall or VPN.
- **Hub-spoke routing**: Route spoke-to-spoke traffic through a hub firewall or NVA.
- **Network Virtual Appliance (NVA)**: Route traffic through a third-party firewall, IDS/IPS, or WAN optimizer.
- **Block internet access**: Route internet traffic to `None` to drop it.
- **Asymmetric routing fix**: Override BGP or system routes to ensure symmetric traffic flow.
- **Service-specific routing**: Direct traffic to specific Azure services through a particular path.

## Next Hop Types

Each UDR specifies a destination address prefix and a next hop. The next hop determines where the traffic goes.

| Next Hop Type | Description | When to Use |
|---------------|-------------|-------------|
| **VirtualAppliance** | Traffic goes to a specific IP (NVA/firewall) | Route through Azure Firewall, third-party NVA |
| **VirtualNetworkGateway** | Traffic goes to the VPN/ExpressRoute gateway | Force traffic to on-premises via gateway |
| **VNetLocal** | Traffic stays within the VNet (override other routes) | Keep intra-VNet traffic local even when other routes exist |
| **Internet** | Traffic goes directly to the internet | Override a forced tunnel for specific prefixes |
| **None** | Traffic is dropped (black-holed) | Block traffic to a specific destination |

### VirtualAppliance Example

```bash
# Route all traffic through Azure Firewall (IP: 10.0.2.4)
az network route-table route create \
  -g MyRG --route-table-name SpokeRouteTable \
  -n DefaultToFirewall \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.2.4
```

### None Example (Block Traffic)

```bash
# Block traffic to a specific range
az network route-table route create \
  -g MyRG --route-table-name RestrictedRouteTable \
  -n BlockExternal \
  --address-prefix 203.0.113.0/24 \
  --next-hop-type None
```

## Route Priority and Selection

When multiple routes match a destination, Azure selects the route using this precedence:

### Priority Order (Highest to Lowest)

1. **Longest prefix match**: A /24 route beats a /16 route for the same destination.
2. **UDRs** (user-defined routes): Override system and BGP routes for the same prefix.
3. **BGP routes**: Routes learned from on-premises via VPN/ExpressRoute gateways.
4. **System routes**: Azure's built-in default routes.

### System Route Defaults

| Destination | Next Hop | Purpose |
|-------------|----------|---------|
| VNet address space | VNet local | Intra-VNet traffic |
| 0.0.0.0/0 | Internet | Default internet route |
| 10.0.0.0/8 | None | RFC 1918 drop (unless in VNet space) |
| 172.16.0.0/12 | None | RFC 1918 drop (unless in VNet space) |
| 192.168.0.0/16 | None | RFC 1918 drop (unless in VNet space) |
| Peered VNet prefix | VNet peering | Traffic to peered VNets |

> **Key insight**: The 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16 drop routes only apply to ranges NOT within the VNet's own address space. If your VNet uses 10.0.0.0/16, traffic to 10.0.x.x stays within the VNet — but traffic to 10.1.0.0/16 would be dropped unless you have a route for it.

## Forced Tunneling

Forced tunneling redirects all internet-bound traffic (0.0.0.0/0) to an on-premises location via VPN or ExpressRoute. This is common in regulated industries that require all traffic to pass through on-premises security appliances.

### Via Azure Firewall (Recommended)

```bash
# Create route table
az network route-table create -g MyRG -n ForcedTunnelRT

# Add default route to Azure Firewall
az network route-table route create \
  -g MyRG --route-table-name ForcedTunnelRT \
  -n ForceTunnel \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.2.4

# Associate with subnet
az network vnet subnet update \
  -g MyRG --vnet-name MyVNet -n AppSubnet \
  --route-table ForcedTunnelRT
```

### Via VPN Gateway (On-Premises)

```bash
# Create route table with BGP propagation disabled
# (prevents VPN gateway from overriding the forced tunnel route)
az network route-table create -g MyRG -n OnPremTunnelRT \
  --disable-bgp-route-propagation true

# Default route to VPN gateway
az network route-table route create \
  -g MyRG --route-table-name OnPremTunnelRT \
  -n ToOnPrem \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualNetworkGateway
```

> **Important**: When using forced tunneling, some Azure services (like Azure Backup, Windows activation) require direct internet access. Add specific UDRs with `--next-hop-type Internet` for the service IP ranges to keep them working.

## Common Routing Scenarios

### Scenario 1: Route All Spoke Traffic Through Hub Firewall

```
Spoke Subnet → UDR (0.0.0.0/0 → Firewall IP) → Hub Firewall → Internet or other spokes
```

```bash
# On the spoke subnet route table:
az network route-table route create \
  -g SpokeRG --route-table-name SpokeRT \
  -n ToFirewall \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.2.4

# Also route to other spoke VNet ranges through the firewall:
az network route-table route create \
  -g SpokeRG --route-table-name SpokeRT \
  -n ToSpoke2 \
  --address-prefix 10.2.0.0/16 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.2.4
```

### Scenario 2: Block Internet Access from a Subnet

```bash
az network route-table route create \
  -g MyRG --route-table-name NoInternetRT \
  -n BlockInternet \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type None
```

> **Warning**: This blocks ALL internet-bound traffic, including traffic to Azure PaaS services accessed via public endpoints. Ensure services use private endpoints or service endpoints before applying.

### Scenario 3: Route to On-Premises via ExpressRoute

When using ExpressRoute, BGP routes are automatically propagated. However, you might need UDRs to override specific BGP routes or force traffic through an NVA first.

```bash
# If BGP learns a route to 172.16.0.0/12 via ExpressRoute,
# but you want that traffic to go through an NVA first:
az network route-table route create \
  -g MyRG --route-table-name CustomRT \
  -n OnPremViaNVA \
  --address-prefix 172.16.0.0/12 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.3.4
```

### Scenario 4: Keep Specific Traffic Local Despite Forced Tunnel

```bash
# Force tunnel everything
az network route-table route create \
  -g MyRG --route-table-name MixedRT \
  -n ForceTunnel \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.2.4

# But allow Azure Backup service tag IPs to go directly to internet
# (Requires knowing the Azure Backup IP ranges for your region)
az network route-table route create \
  -g MyRG --route-table-name MixedRT \
  -n AllowAzureBackup \
  --address-prefix 20.36.0.0/16 \
  --next-hop-type Internet
```

## Route Table Association

Route tables are associated with subnets (not VNets or NICs). Every VM in the subnet follows the same route table.

```bash
# Create and associate a route table
az network route-table create -g MyRG -n AppRouteTable
az network vnet subnet update \
  -g MyRG --vnet-name MyVNet -n AppSubnet \
  --route-table AppRouteTable

# Remove route table association
az network vnet subnet update \
  -g MyRG --vnet-name MyVNet -n AppSubnet \
  --route-table ""
```

### Association Rules

1. A subnet can have **at most one** route table associated.
2. A route table can be associated with **multiple subnets** (even across VNets in the same region).
3. If no route table is associated, the subnet uses system routes only.
4. Changing the route table takes effect within seconds — no VM restart needed.

## Effective Routes

The effective route table is the merged result of system routes, BGP routes, and UDRs for a specific NIC. This is what Azure actually uses for routing decisions.

```bash
# View effective routes for a VM's NIC
az network nic show-effective-route-table -g MyRG -n MyVM-NIC -o table

# Example output:
# Source    State    Address Prefix    Next Hop Type       Next Hop IP
# ------   ------   ---------------   -----------------   -----------
# Default  Active   10.0.0.0/16       VnetLocal
# Default  Active   0.0.0.0/0         Internet
# User     Active   0.0.0.0/0         VirtualAppliance    10.0.2.4
# Default  Invalid  0.0.0.0/0         Internet            (overridden by UDR)
```

**Reading effective routes**:
- **Source**: `Default` (system), `User` (UDR), `VirtualNetworkGateway` (BGP)
- **State**: `Active` (in use) or `Invalid` (overridden by a higher-priority route)
- When a UDR and system route have the same prefix, the UDR wins and the system route shows as "Invalid."

## The 0.0.0.0/0 Route

The `0.0.0.0/0` route is the default route — it matches ALL traffic that doesn't match a more specific route. It is the most commonly customized route.

**Default behavior**: Azure routes 0.0.0.0/0 to the internet.

**Common overrides**:
- 0.0.0.0/0 → VirtualAppliance (Azure Firewall or NVA)
- 0.0.0.0/0 → VirtualNetworkGateway (forced tunnel to on-premises)
- 0.0.0.0/0 → None (block all internet access)

> **Warning**: Overriding 0.0.0.0/0 affects ALL outbound traffic not matched by a more specific route. This includes traffic to Azure management plane services. Ensure you add specific routes for Azure services that need direct connectivity.

## BGP Route Propagation

By default, routes learned from VPN/ExpressRoute gateways via BGP are propagated to all subnets in the VNet. You can disable this per route table.

```bash
# Disable BGP propagation on a route table
az network route-table update -g MyRG -n MyRT --disable-bgp-route-propagation true
```

**When to disable BGP propagation**:
- On subnets where you want only UDRs to control routing (e.g., AzureFirewallSubnet).
- When BGP routes conflict with your UDR-based forced tunneling design.
- On management subnets that should not learn on-premises routes.

## Troubleshooting

### Asymmetric Routing

**Symptom**: Traffic goes out one path but returns via a different path. Stateful firewalls drop the return traffic.
**Cause**: UDRs only control traffic in one direction. Return traffic may take a different route if the other subnet's route table does not send it back through the same path.
**Fix**: Ensure UDRs are configured on ALL subnets involved in the traffic flow to maintain symmetric routing. Both the source and destination subnets need route tables that point to the same firewall/NVA.

### Black-Holed Traffic

**Symptom**: Traffic disappears — no response and no errors.
**Cause**: A `None` next hop route is matching the traffic and dropping it, or a VirtualAppliance next hop points to a non-existent or down NVA.
**Fix**: Check effective routes. Verify the NVA IP is correct and the NVA is running and has IP forwarding enabled.

```bash
# Check if IP forwarding is enabled on the NVA NIC
az network nic show -g MyRG -n NVA-NIC --query enableIpForwarding

# Enable IP forwarding on the NVA NIC
az network nic update -g MyRG -n NVA-NIC --ip-forwarding true
```

### Missing Routes

**Symptom**: Traffic to a peered VNet or on-premises is not flowing.
**Cause**: UDR overrides the system or BGP route for that destination. Or BGP propagation is disabled on the route table.
**Fix**: Check effective routes. Add a specific UDR for the missing destination, or re-enable BGP propagation if needed.

### NVA Not Forwarding Traffic

**Symptom**: UDR points to NVA but traffic doesn't reach the destination.
**Causes**:
1. **IP forwarding not enabled** on the NVA NIC (Azure setting).
2. **IP forwarding not enabled** inside the NVA OS (Linux: `net.ipv4.ip_forward=1`).
3. **NVA firewall rules** blocking the traffic.
4. **NVA has an NSG** that blocks the forwarded traffic.

**Fix**: Enable IP forwarding at both the Azure NIC level and the OS level. Verify NVA firewall rules.

```bash
# Enable at Azure level
az network nic update -g MyRG -n NVA-NIC --ip-forwarding true

# Enable at Linux OS level (run inside the NVA VM)
# sudo sysctl -w net.ipv4.ip_forward=1
# echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
```

### Route Table Not Taking Effect

**Symptom**: Route table is configured but traffic ignores it.
**Cause**: Route table is not associated with the correct subnet, or the specific route uses an incorrect prefix.
**Fix**: Verify association and check that the address prefix in the UDR matches the intended traffic.

```bash
# Verify route table association
az network vnet subnet show -g MyRG --vnet-name MyVNet -n AppSubnet \
  --query 'routeTable.id'

# List all routes in the table
az network route-table route list -g MyRG --route-table-name AppRouteTable -o table
```
