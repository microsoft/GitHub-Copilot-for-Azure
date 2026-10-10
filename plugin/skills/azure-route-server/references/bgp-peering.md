# BGP Peering with Azure Route Server

## Overview

Azure Route Server acts as a managed BGP route reflector deployed inside your virtual network. It establishes eBGP peering sessions with network virtual appliances (NVAs) and exchanges routes dynamically — eliminating the need for manual UDR maintenance whenever network topology changes.

Route Server does not sit in the data path. It only participates in the control plane by learning routes from NVAs and programming them into the VNet's effective route table, and by advertising VNet address space (and optionally VPN/ExpressRoute routes) back to the NVAs.

## ASN Requirements

### Route Server ASN

Route Server always uses **ASN 65515**. This is fixed and cannot be changed. All peering sessions between Route Server and NVAs are eBGP sessions because the NVA must use a different ASN.

### NVA ASN Selection

| ASN Range | Usage |
|-----------|-------|
| 1–64495 | Valid for NVA peering with Route Server |
| 64512–65514 | Private ASN range — recommended for NVAs |
| 65515 | **Reserved** — Route Server's own ASN; cannot be used by peers |
| 65520 | **Reserved** — used by ExpressRoute; cannot be used by peers |
| 65521–65534 | Reserved by Azure for internal use |
| 65535 | IANA reserved |

**Recommendation:** Use private ASNs in the range **64512–65514** for your NVAs. This avoids conflicts with public ASNs and Azure-reserved ranges.

If your NVA needs to peer with external BGP neighbors using a public ASN, that same public ASN can be used to peer with Route Server as long as it falls within 1–64495.

## Peering Setup Walkthrough

### Prerequisites

1. A virtual network with a subnet named `RouteServerSubnet` (/27 or larger).
2. A deployed Route Server instance in that subnet.
3. An NVA deployed in the same VNet (or a VNet-peered VNet) with BGP capability.
4. The NVA's private IP address and chosen ASN.

### Step 1: Retrieve Route Server Peering IPs

After creating the Route Server, retrieve the two peering IP addresses:

```bash
az network routeserver show -g MyRG -n MyRouteServer --query "virtualRouterIps" -o tsv
```

This returns two IPs, for example `10.0.1.4` and `10.0.1.5`. These are the Route Server instance IPs that the NVA must peer with.

### Step 2: Register the NVA as a BGP Peer on Route Server

```bash
az network routeserver peering create -g MyRG --routeserver MyRouteServer \
  -n NVAPeer1 --peer-asn 65001 --peer-ip 10.0.2.4
```

### Step 3: Configure BGP on the NVA

On the NVA, configure two eBGP neighbor sessions:

- **Neighbor 1:** Route Server IP `10.0.1.4`, remote ASN `65515`
- **Neighbor 2:** Route Server IP `10.0.1.5`, remote ASN `65515`

The NVA should advertise its desired prefixes to both neighbors and accept routes from both.

Example (generic BGP configuration pseudocode):

```text
router bgp 65001
  neighbor 10.0.1.4 remote-as 65515
  neighbor 10.0.1.5 remote-as 65515
  network 172.16.0.0/16
```

### Step 4: Verify Peering

```bash
# Check peering status
az network routeserver peering list -g MyRG --routeserver MyRouteServer -o table

# Check learned routes
az network routeserver peering list-learned-routes -g MyRG --routeserver MyRouteServer -n NVAPeer1

# Check advertised routes
az network routeserver peering list-advertised-routes -g MyRG --routeserver MyRouteServer -n NVAPeer1
```

## Why You Must Peer with Both Route Server Instances

Route Server is deployed as a pair of instances for high availability. Each instance has its own private IP in the RouteServerSubnet. If your NVA only peers with one instance:

- **Failover gap:** If that instance undergoes maintenance or fails, all learned routes are withdrawn and traffic blackholes until the instance recovers.
- **Incomplete route view:** Each instance independently manages its BGP sessions. Peering with only one means the other instance has no routes from your NVA.

**Always configure the NVA to peer with both IPs.** Both sessions should be active simultaneously — this is not an active/standby configuration.

## Route Propagation Behavior

When an NVA advertises a prefix (e.g., `172.16.0.0/16`) to Route Server:

1. Route Server receives the BGP UPDATE from the NVA.
2. Route Server programs the route into the VNet's effective route table.
3. The route appears on all NICs in the VNet with source **"Virtual Network Gateway"** and next hop set to the NVA's private IP.
4. VMs in the VNet now send traffic destined for `172.16.0.0/16` to the NVA.

In the reverse direction, Route Server advertises the VNet's address space and (if branch-to-branch is enabled) any VPN/ExpressRoute routes to the NVA.

### What Route Server Advertises to NVAs

| Condition | Routes Advertised |
|-----------|-------------------|
| Default | VNet address prefixes, peered VNet prefixes |
| Branch-to-branch enabled | Above + VPN Gateway learned routes + ExpressRoute learned routes |

## Route Exchange with VPN and ExpressRoute Gateways

When Route Server coexists with a VPN Gateway or ExpressRoute Gateway in the same VNet:

- **Without branch-to-branch:** Gateways and Route Server operate independently. NVAs do not learn on-premises routes from the gateways.
- **With branch-to-branch enabled:** Route Server acts as a route reflector between the gateways and the NVAs. On-premises routes from VPN/ExpressRoute are advertised to NVA peers, and NVA routes are advertised to the gateways.

This enables powerful transit scenarios — for example, traffic from an on-premises branch can reach an SD-WAN overlay network through an NVA in the hub VNet.

```text
On-premises ←→ VPN/ER Gateway ←→ Route Server ←→ NVA ←→ SD-WAN branches
```

**Important:** Branch-to-branch causes all NVA routes to be advertised to on-premises via the gateway. Ensure your NVA only advertises prefixes you intend to be reachable from on-premises.

## BGP Communities

Route Server supports standard BGP communities on learned routes. NVAs can tag routes with communities, and Route Server will preserve them when programming routes. However, Route Server itself does not perform community-based filtering — it accepts all valid routes from configured peers.

When branch-to-branch is enabled, communities from NVA routes are carried through to VPN/ExpressRoute advertisements and vice versa. This allows on-premises routers to make policy decisions based on communities set by the NVA.

## Route Filtering

### What Route Server Does

- Accepts all valid BGP routes from configured peers (up to the per-peer route limit).
- Programs all learned routes into VNet effective routes.
- Advertises VNet and (optionally) gateway routes to NVA peers.

### What Route Server Does NOT Do

- Route Server does **not** support route maps or prefix lists.
- Route Server does **not** filter or modify routes in transit.
- Route Server does **not** perform route summarization.
- Route Server does **not** support conditional advertisement.

All filtering must be performed on the NVA side using the NVA's own BGP policy capabilities.

## Branch-to-Branch Transit

### Enabling

```bash
az network routeserver update -g MyRG -n MyRouteServer --allow-b2b-traffic true
```

### Use Cases

- **SD-WAN integration:** On-premises branches reach SD-WAN branches through an NVA.
- **VPN-to-ExpressRoute transit:** Traffic between VPN-connected sites and ExpressRoute-connected sites transits through an NVA for inspection.
- **Multi-site NVA routing:** NVA aggregates routes from multiple remote sites and advertises them to Azure and on-premises.

### Implications

- Increases route table size on gateways (NVA routes are now advertised to on-premises).
- On-premises routers see NVA-advertised prefixes with ASN path: `65515 <NVA-ASN>`.
- Traffic between on-premises and NVA destinations transits the NVA in the data plane — ensure NVA has sufficient throughput.
- If NVA advertises a default route (`0.0.0.0/0`), it will be propagated to on-premises — this can inadvertently redirect all on-premises internet traffic.

## Multi-Homing and ECMP

Route Server supports Equal-Cost Multi-Path (ECMP) routing. When two or more NVAs advertise the **same prefix** with the same AS path length:

1. Route Server learns the route from each NVA.
2. Route Server programs **multiple next hops** for that prefix in the VNet effective routes.
3. Azure fabric distributes traffic across the NVAs using 5-tuple hash-based load balancing.

This provides both redundancy and increased throughput without requiring a load balancer in front of the NVAs.

**Example:** Two NVAs (10.0.2.4 and 10.0.2.5) both advertise `172.16.0.0/16` with ASN 65001. VMs in the VNet see two effective routes for `172.16.0.0/16`, each pointing to a different NVA. Traffic is distributed across both.

### ECMP Requirements

- Both NVAs must advertise the same prefix with the same AS path length.
- Both NVAs must be peered with Route Server.
- Maximum 8 ECMP paths (limited by the 8-peer maximum).

## BGP Timers

Route Server uses the following BGP timer defaults:

| Timer | Value |
|-------|-------|
| Keepalive interval | 60 seconds |
| Hold time | 180 seconds |

These timers are **not configurable** on Route Server. If the NVA does not send a keepalive within the hold time (180 seconds), Route Server declares the peer down and withdraws all routes learned from that peer.

**Convergence note:** When an NVA fails, it can take up to 180 seconds for routes to be withdrawn. For faster failover, configure BFD (Bidirectional Forwarding Detection) on the NVA if supported, though note that Route Server itself does not support BFD — the NVA-side BFD can detect data-plane failures and withdraw BGP routes proactively.

## Troubleshooting

### Peering Not Establishing

| Symptom | Possible Cause | Resolution |
|---------|---------------|------------|
| Peering stuck in "Connecting" | NVA not configured to peer with Route Server IPs | Configure NVA BGP neighbors for both Route Server IPs |
| Peering stuck in "Connecting" | NVA using ASN 65515 | Change NVA ASN — 65515 is reserved for Route Server |
| Peering stuck in "Connecting" | NSG blocking TCP port 179 | Ensure no NSG on RouteServerSubnet or NVA subnet blocks BGP (TCP 179) |
| Peering stuck in "Connecting" | NVA in a different VNet without peering | Enable VNet peering and ensure "Allow forwarded traffic" is set |
| Peering flapping | NVA overloaded, dropping keepalives | Investigate NVA CPU/memory; increase NVA capacity |

### Routes Not Propagated

| Symptom | Possible Cause | Resolution |
|---------|---------------|------------|
| NVA routes not in effective routes | NVA not advertising prefixes | Check NVA BGP config — ensure `network` statements or redistribution is configured |
| VNet routes not reaching NVA | Route Server not advertising VNet prefixes | Verify peering is established; check `list-advertised-routes` |
| On-premises routes not reaching NVA | Branch-to-branch not enabled | Enable with `--allow-b2b-traffic true` |
| Routes appearing then disappearing | NVA withdrawing routes | Check NVA logs for BGP withdrawal messages |
| Route limit exceeded | NVA advertising >10,000 routes | Reduce advertised prefixes or summarize on the NVA side |

### Asymmetric Routing

Asymmetric routing occurs when forward and return traffic take different paths. Common scenarios:

- **NVA advertises a more specific prefix than expected:** Return traffic bypasses the intended path. Ensure NVA prefix advertisement matches the intended routing design.
- **UDR and Route Server conflict:** A UDR points traffic to NVA-A, but Route Server learns a route pointing to NVA-B. UDR wins for the same prefix — remove conflicting UDRs or align them.
- **Single-NVA peering:** Only one NVA is peered with Route Server. Traffic may arrive at the NVA via Route Server routes but return via a different path. Peer both NVAs.

### Incorrect ASN Configuration

If the NVA is configured with the wrong remote ASN (not 65515) for Route Server, the BGP OPEN message will be rejected. Verify:

```bash
# On Route Server side — check peering configuration
az network routeserver peering list -g MyRG --routeserver MyRouteServer -o table

# On NVA side — ensure remote-as is 65515 for both Route Server IPs
```
