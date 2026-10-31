# Routing Troubleshooting Guide

Diagnose and fix Azure network routing issues including UDR conflicts, asymmetric routing, BGP route propagation failures, and unexpected next hops.

## How Azure Routing Works

Azure uses a routing precedence hierarchy. When multiple routes match a destination, the most specific prefix wins. For equal prefixes:

1. **User-Defined Routes (UDR)** — highest priority
2. **BGP routes** — from VPN Gateway or ExpressRoute
3. **System routes** — Azure default routes

## Gathering Routing Information

### View effective routes on a NIC

```bash
az network nic show-effective-route-table \
  --resource-group <rg> \
  --name <nic-name> \
  --output table
```

This shows the MERGED result of system routes, UDRs, and BGP routes. This is the ground truth for what the VM actually uses.

### View the route table attached to a subnet

```bash
# Find which route table is attached
az network vnet subnet show \
  --resource-group <rg> \
  --vnet-name <vnet> \
  --name <subnet> \
  --query "routeTable.id"

# List routes in the table
az network route-table route list \
  --resource-group <rg> \
  --route-table-name <rt-name> \
  --output table
```

### Check next hop for a specific destination

```bash
az network watcher show-next-hop \
  --resource-group <rg> \
  --vm <vm-name> \
  --source-ip <source-ip> \
  --dest-ip <dest-ip>
```

## Common Routing Problems

### Problem: UDR Conflicts

**Symptom:** Traffic goes to an unexpected destination after adding or modifying a UDR.

**Diagnosis:**

```bash
# View effective routes and look for conflicting entries
az network nic show-effective-route-table -g <rg> -n <nic> -o json | \
  jq '.value[] | {prefix: .addressPrefix[], nextHop: .nextHopIpAddress[], nextHopType: .nextHopType, source: .source}'
```

**Common causes:**
- A broader UDR (`10.0.0.0/8`) overriding what you expected from a more specific system route — but check: longest prefix match still applies, so `/16` beats `/8`.
- Multiple route tables with conflicting routes on different subnets in the same VNet.
- A UDR pointing to an NVA IP that is down or does not have IP forwarding enabled.

**Fix:**
```bash
# Update a route to fix the next hop
az network route-table route update \
  --resource-group <rg> \
  --route-table-name <rt-name> \
  --name <route-name> \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <correct-nva-ip>

# Or remove a conflicting route
az network route-table route delete \
  --resource-group <rg> \
  --route-table-name <rt-name> \
  --name <route-name>
```

### Problem: Asymmetric Routing

**Symptom:** Outbound traffic follows one path, return traffic follows a different path. Causes connection failures with stateful firewalls/NVAs.

**Diagnosis:**
1. Check effective routes on BOTH source and destination VMs
2. If an NVA or Azure Firewall is in the path, verify the return traffic also traverses it

```bash
# Check route from source to destination
az network watcher show-next-hop -g <rg> --vm <source-vm> --source-ip <src-ip> --dest-ip <dst-ip>

# Check route from destination back to source
az network watcher show-next-hop -g <rg> --vm <dest-vm> --source-ip <dst-ip> --dest-ip <src-ip>
```

**Common causes:**
- UDR on the source subnet routes traffic through a firewall, but the destination subnet has no UDR routing return traffic through the same firewall.
- VPN/ExpressRoute gateway subnet has BGP routes that create asymmetric return paths.
- Load balancer with Direct Server Return (DSR) creates asymmetric flows by design.

**Fix:** Ensure UDRs are applied symmetrically. Both subnets involved in a flow must route through the same firewall/NVA:

```bash
# Create return-path route on the destination subnet's route table
az network route-table route create \
  --resource-group <rg> \
  --route-table-name <dest-subnet-rt> \
  --name return-via-firewall \
  --address-prefix <source-subnet-prefix> \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <firewall-ip>
```

### Problem: Route Propagation from VPN/ExpressRoute Gateway

**Symptom:** On-premises routes not appearing in VNet effective routes, or stale routes persisting after changes.

**Diagnosis:**

```bash
# Check if BGP route propagation is enabled on the subnet
az network vnet subnet show \
  --resource-group <rg> \
  --vnet-name <vnet> \
  --name <subnet> \
  --query "routeTable.properties.disableBgpRoutePropagation"
# false = propagation enabled (default), true = disabled

# Check BGP routes learned by the gateway
az network vnet-gateway list-learned-routes \
  --resource-group <rg> \
  --name <gateway-name> \
  --output table

# Check BGP routes advertised to a peer
az network vnet-gateway list-advertised-routes \
  --resource-group <rg> \
  --name <gateway-name> \
  --peer <peer-ip> \
  --output table
```

**Common causes:**
- `disableBgpRoutePropagation` set to `true` on the route table — BGP routes from the gateway won't reach subnets using that route table.
- BGP session is down between the gateway and peer.
- On-premises device is not advertising the expected prefixes.
- A UDR with the same prefix overrides the BGP route.

**Fix:**
```bash
# Re-enable BGP route propagation on a route table
az network route-table update \
  --resource-group <rg> \
  --name <rt-name> \
  --disable-bgp-route-propagation false
```

### Problem: VNet Peering Route Issues

**Symptom:** VMs in peered VNets cannot communicate, or on-premises routes are not transiting through peering.

**Diagnosis:**

```bash
# Check peering status (must be "Connected" on both sides)
az network vnet peering show \
  --resource-group <rg> \
  --vnet-name <vnet> \
  --name <peering-name> \
  --query "{state:peeringState, allowForwardedTraffic:allowForwardedTraffic, allowGatewayTransit:allowGatewayTransit, useRemoteGateways:useRemoteGateways}"

# Verify both sides
az network vnet peering list -g <rg1> --vnet-name <vnet1> -o table
az network vnet peering list -g <rg2> --vnet-name <vnet2> -o table
```

**Transitive routing through peering is NOT automatic.** VNet A peered with VNet B, and VNet B peered with VNet C, does NOT mean A can reach C. Options:
- Use Azure Virtual WAN (provides transitive routing)
- Use Azure Route Server with an NVA
- Use UDRs with an NVA to forward traffic

**Gateway transit settings:**
- Hub VNet (with gateway): Set `allowGatewayTransit: true`
- Spoke VNet: Set `useRemoteGateways: true`

```bash
# Enable gateway transit on the hub side
az network vnet peering update \
  --resource-group <hub-rg> \
  --vnet-name <hub-vnet> \
  --name <peering-to-spoke> \
  --set allowGatewayTransit=true

# Enable use of remote gateway on the spoke side
az network vnet peering update \
  --resource-group <spoke-rg> \
  --vnet-name <spoke-vnet> \
  --name <peering-to-hub> \
  --set useRemoteGateways=true
```

### Problem: BGP Route Troubleshooting

**Symptom:** BGP peering is established but expected routes are missing or incorrect.

```bash
# Check BGP peer status
az network vnet-gateway list-bgp-peer-status \
  --resource-group <rg> \
  --name <gateway-name> \
  --output table

# Check learned routes (what the gateway learned from peers)
az network vnet-gateway list-learned-routes \
  --resource-group <rg> \
  --name <gateway-name> \
  --output table

# Check advertised routes (what the gateway tells its peers)
az network vnet-gateway list-advertised-routes \
  --resource-group <rg> \
  --name <gateway-name> \
  --peer <peer-ip> \
  --output table
```

**BGP route selection (when multiple paths exist):**
1. Longest prefix match
2. Shortest AS path
3. Lowest origin type (IGP < EGP < Incomplete)
4. Lowest MED
5. eBGP over iBGP
6. Lowest router ID

### Problem: Traffic Being Black-Holed

**Symptom:** Traffic silently disappears. No ICMP unreachable, no timeout — just no response.

**Diagnosis:**
```bash
# Look for routes with next hop "None"
az network nic show-effective-route-table -g <rg> -n <nic> -o json | \
  jq '.value[] | select(.nextHopType == "None") | {prefix: .addressPrefix[], source: .source}'
```

**Common causes:**
- UDR with next hop type "None" — intentional black hole (used to prevent traffic to specific destinations)
- UDR pointing to an NVA that is down
- NVA without IP forwarding enabled on its NIC

```bash
# Verify IP forwarding is enabled on the NVA NIC
az network nic show -g <rg> -n <nva-nic> --query "enableIpForwarding"

# Enable IP forwarding if disabled
az network nic update -g <rg> -n <nva-nic> --ip-forwarding true
```

## Route Table Best Practices

- **One route table per subnet role.** Don't share route tables between subnets with different routing requirements.
- **Document every UDR.** Use the `--name` field descriptively (e.g., `to-hub-firewall`, `block-internet`).
- **Test after changes.** Always run `show-next-hop` after modifying routes.
- **Be explicit about return paths.** If you route traffic through a firewall in one direction, route the return path through the same firewall.
- **Avoid overlapping prefixes** in UDRs unless you intentionally need longest-prefix-match behavior.

## Related Resources

- [Virtual network traffic routing](https://learn.microsoft.com/azure/virtual-network/virtual-networks-udr-overview)
- [Diagnose a VM network routing problem](https://learn.microsoft.com/azure/virtual-network/diagnose-network-routing-problem)
- [BGP with Azure VPN Gateway](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-bgp-overview)
- For VPN-specific routing → use `azure-vpn-gateway` skill
- For Virtual WAN routing → use `azure-virtual-wan` skill
