# NVA Integration Patterns with Azure Route Server

## Overview

Azure Route Server enables dynamic routing between network virtual appliances (NVAs) and Azure virtual networks. Instead of maintaining static UDRs that must be updated whenever topology changes, Route Server allows NVAs to advertise and withdraw routes via BGP in real time. This document covers common NVA deployment patterns, configuration requirements, and troubleshooting guidance.

## Common NVA Deployment Patterns

### Single NVA Hub Pattern

The simplest pattern: one NVA in a hub VNet peers with Route Server and advertises routes for remote networks (on-premises, other clouds, SD-WAN branches).

```text
Spoke VNets ←(peering)→ Hub VNet
                            ├── Route Server (learns routes from NVA)
                            ├── NVA (BGP peer, next hop for remote prefixes)
                            └── (optional) VPN/ER Gateway
```

**How it works:**

1. NVA establishes BGP peering with Route Server (both instances).
2. NVA advertises remote prefixes (e.g., `10.100.0.0/16` for on-premises).
3. Route Server programs these routes into the hub VNet effective route table.
4. Spoke VNets with "Use Remote Gateway" enabled on peering inherit these routes.
5. VMs in hub and spoke VNets send traffic for `10.100.0.0/16` to the NVA's private IP.

**Limitation:** Single point of failure. If the NVA goes down, all dynamically learned routes are withdrawn after the BGP hold timer expires (up to 180 seconds).

### Active-Active NVA Pair with ECMP

Two identical NVAs peer with Route Server and advertise the same prefixes. Route Server programs ECMP routes with both NVAs as next hops.

```text
Spoke VNets ←(peering)→ Hub VNet
                            ├── Route Server
                            ├── NVA-1 (10.0.2.4, ASN 65001) ──→ advertises 10.100.0.0/16
                            └── NVA-2 (10.0.2.5, ASN 65001) ──→ advertises 10.100.0.0/16
```

**Traffic distribution:** Azure fabric uses 5-tuple hashing (source IP, destination IP, source port, destination port, protocol) to distribute flows across both NVAs. Individual flows stick to one NVA; aggregate traffic is balanced.

**Failover:** When one NVA fails, Route Server withdraws its routes after the hold timer (180s). All traffic shifts to the surviving NVA. Recovery is automatic when the failed NVA re-establishes peering.

**Configuration notes:**

- Both NVAs can use the same ASN (e.g., 65001).
- Both must advertise identical prefixes with the same AS path length for ECMP.
- Both must peer with both Route Server instances (4 total BGP sessions).

### Multi-NVA for Different Route Domains

Different NVAs handle different route domains — for example, one NVA for on-premises connectivity and another for internet/security inspection.

```text
Hub VNet
  ├── Route Server
  ├── NVA-Firewall (ASN 65001)  → advertises 0.0.0.0/0 (internet via firewall)
  └── NVA-SDWAN (ASN 65002)     → advertises 10.100.0.0/16 (SD-WAN branches)
```

Each NVA advertises only its relevant prefixes. Route Server programs all routes — VMs route internet traffic to the firewall NVA and SD-WAN traffic to the SD-WAN NVA based on longest prefix match.

**Key consideration:** If both NVAs advertise overlapping prefixes, longest prefix match determines the winner. If prefixes are identical and AS path lengths differ, the shorter AS path wins. If everything is equal, both become ECMP next hops — which may not be desired if the NVAs serve different functions.

## Route Server + SD-WAN NVA Pattern

SD-WAN appliances (Cisco Viptela, VMware SD-WAN, Versa, Silver Peak) commonly integrate with Route Server to:

1. Advertise SD-WAN branch prefixes into the Azure VNet.
2. Learn Azure VNet and on-premises (VPN/ExpressRoute) prefixes to advertise to SD-WAN branches.

**Architecture:**

```text
SD-WAN branches ←(overlay)→ SD-WAN NVA in Hub VNet ←(BGP)→ Route Server
                                                                  ↓
                                                      VNet effective routes
                                                      (spoke VMs reach branches)
```

**With branch-to-branch enabled:**

```text
On-premises ←(VPN/ER)→ Gateway ←(Route Server)→ SD-WAN NVA ←(overlay)→ SD-WAN branches
```

On-premises sites learn SD-WAN branch routes via the VPN/ExpressRoute gateway, and SD-WAN branches learn on-premises routes via the NVA. All transit traffic flows through the SD-WAN NVA.

## Route Server + Firewall NVA Pattern

Third-party firewall NVAs from Azure Marketplace (Palo Alto VM-Series, Fortinet FortiGate, Check Point CloudGuard, Cisco FTDv) can peer with Route Server to inject themselves as the next hop for inspected traffic.

**Common approach:**

1. Firewall NVA advertises a default route (`0.0.0.0/0`) via BGP to Route Server.
2. Route Server programs the default route into VNet effective routes.
3. All internet-bound traffic from VMs flows through the firewall NVA.
4. Firewall NVA also advertises specific prefixes for east-west inspection between spokes.

**Warning:** Advertising `0.0.0.0/0` from the NVA overrides the Azure default internet route for all VMs in the VNet and peered spoke VNets. This is powerful but affects all subnets — including those that may need direct internet access (e.g., Azure Bastion, Application Gateway). Use UDRs on specific subnets to override the NVA default route where needed.

**Example — Palo Alto integration:**

```bash
# 1. Deploy Palo Alto NVA from Marketplace (portal or Terraform)
# 2. Configure BGP on Palo Alto (ASN 65001, neighbors = Route Server IPs)
# 3. Register peer on Route Server
az network routeserver peering create -g MyRG --routeserver MyRouteServer \
  -n PaloAltoPeer --peer-asn 65001 --peer-ip 10.0.3.4

# 4. Verify
az network routeserver peering list-learned-routes -g MyRG \
  --routeserver MyRouteServer -n PaloAltoPeer
```

## Route Exchange Flow

Understanding the full route exchange cycle is critical for debugging:

```text
Step 1: NVA advertises prefix (e.g., 172.16.0.0/16) to Route Server via BGP
Step 2: Route Server programs 172.16.0.0/16 into VNet effective routes
        → next hop = NVA private IP (e.g., 10.0.2.4)
        → source = "Virtual Network Gateway"
Step 3: VM in VNet sends packet to 172.16.1.10
        → Azure fabric routes packet to 10.0.2.4 (the NVA)
Step 4: NVA receives the packet on its NIC and forwards it to the actual destination
        → IP forwarding MUST be enabled on the NVA NIC
Step 5: Return traffic follows reverse path (or symmetric if correctly configured)
```

**Key insight:** Route Server only handles the control plane (step 1–2). The NVA handles the data plane (step 4). Azure fabric handles packet delivery between VMs and NVA (step 3).

## NVA Requirements

### BGP Support

The NVA must support BGP (eBGP specifically) and be capable of:

- Establishing eBGP sessions with ASN 65515 (Route Server's ASN).
- Advertising prefixes it wants to inject into the VNet.
- Accepting routes from Route Server (VNet and optionally gateway prefixes).

### Network Connectivity

| Requirement | Detail |
|-------------|--------|
| Location | NVA must be in the same VNet as Route Server, or in a VNet peered to it |
| IP addressing | NVA BGP peering uses the NVA's private IP (not public IP) |
| Peering peers | NVA must peer with both Route Server instance IPs |
| Port access | TCP 179 (BGP) must be allowed between NVA and RouteServerSubnet |

### IP Forwarding — Critical Requirement

**IP forwarding MUST be enabled on the NVA's NIC** for transit traffic to work. Without it, Azure fabric drops packets not destined for the NVA's own IP.

```bash
# Enable IP forwarding on NVA NIC
az network nic update -g MyRG -n NVA-NIC --ip-forwarding true
```

This is the single most common cause of "routes are programmed but traffic doesn't flow through the NVA."

## UDR Interaction with Route Server

### When UDRs Are Still Needed

Even with Route Server, UDRs are necessary in these scenarios:

| Scenario | Why UDR Is Needed |
|----------|-------------------|
| Force traffic from specific subnets to NVA | Route Server programs routes VNet-wide; UDRs provide per-subnet control |
| Override an NVA-advertised default route on certain subnets | Azure Bastion, Application Gateway, and other PaaS services may break with NVA as default gateway |
| Ensure spoke-to-spoke traffic through NVA | Spoke-to-spoke traffic via VNet peering may bypass NVA; UDRs on spoke subnets ensure it transits the NVA |
| Static fallback route | If BGP peering fails, a UDR ensures critical traffic still has a path |

### Route Precedence

When both UDRs and Route Server routes exist for the same prefix:

1. **UDR wins** for an exact prefix match.
2. **Longest prefix match** applies across all route sources — a more specific BGP route beats a less specific UDR.
3. If no UDR or BGP route matches, Azure system routes apply.

### Comparing Route Server with UDRs

| Dimension | Route Server (BGP) | UDRs |
|-----------|-------------------|------|
| Route updates | Automatic via BGP | Manual (or scripted/automated) |
| Failover | Automatic on BGP peer down | Requires manual or scripted switchover |
| Scope | VNet-wide | Per-subnet |
| Prefix limit | 10,000 per peer (Standard) | 400 per route table |
| NVA requirement | Must support BGP | No BGP needed |
| Complexity | Higher initial setup | Simple but harder to maintain at scale |

## Hub-Spoke Architecture with Route Server

In a hub-spoke topology:

1. Route Server is deployed in the **hub VNet**.
2. NVAs are deployed in the **hub VNet** (same VNet as Route Server).
3. Spoke VNets peer with the hub using **"Use Remote Gateways"** (on spoke side) and **"Allow Gateway Transit"** (on hub side).
4. Routes learned by Route Server propagate to spoke VNets via the peering gateway transit setting.

```text
Spoke-1 (10.1.0.0/16) ──┐
Spoke-2 (10.2.0.0/16) ──┤── peering ──→ Hub VNet (10.0.0.0/16)
Spoke-3 (10.3.0.0/16) ──┘                  ├── Route Server
                                            ├── NVA (advertises 172.16.0.0/12)
                                            └── VPN Gateway (optional)
```

VMs in all spokes see `172.16.0.0/12 → next hop 10.0.2.4 (NVA)` in their effective routes.

**Important:** For spoke-to-spoke traffic to transit through the NVA, the NVA must advertise the spoke VNet prefixes back (or a summary that covers them). Alternatively, use UDRs on spoke subnets to force spoke-to-spoke traffic through the NVA.

## Failover Behavior

### What Happens When an NVA Goes Down

1. The NVA stops sending BGP keepalives to Route Server.
2. Route Server waits for the hold timer to expire (**180 seconds**).
3. Route Server declares the peer down and withdraws all routes learned from that NVA.
4. VNet effective routes are updated — traffic shifts to any remaining ECMP next hops.
5. If no other NVA advertises the same prefix, the route is removed entirely and traffic falls back to the next matching route (UDR or system route).

### Reducing Failover Time

- **Deploy active-active NVAs with ECMP.** When one NVA fails, the other immediately handles all traffic — no waiting for hold timer on the surviving NVA.
- **NVA-side health monitoring:** Configure the NVA to proactively withdraw BGP routes if it detects data-plane failure (e.g., tunnel down, upstream unreachable). This triggers immediate Route Server convergence instead of waiting 180 seconds.
- **BFD on NVA side:** Some NVAs support BFD for fast failure detection. While Route Server does not support BFD, the NVA can use BFD with other peers and withdraw BGP routes to Route Server when BFD detects a failure.

## Troubleshooting

### Traffic Not Forwarding Through NVA

| Check | Command / Action |
|-------|-----------------|
| IP forwarding enabled on NVA NIC? | `az network nic show -g MyRG -n NVA-NIC --query "enableIPForwarding"` |
| NVA receiving traffic? | Packet capture on NVA NIC |
| Effective routes show NVA as next hop? | `az network nic show-effective-route-table -g MyRG -n VM-NIC -o table` |
| NSG blocking traffic to/from NVA? | Check NSG rules on NVA subnet and VM subnet |
| NVA internal routing correct? | Verify NVA forwards packets out the correct interface |

### NVA Not Receiving Traffic Despite Routes Being Programmed

This almost always means **IP forwarding is not enabled** on the NVA NIC. Azure drops packets at the fabric level when a NIC receives traffic not addressed to its own IP and IP forwarding is disabled.

```bash
# Fix
az network nic update -g MyRG -n NVA-NIC --ip-forwarding true
```

Also verify that the NVA's OS-level IP forwarding is enabled (e.g., `net.ipv4.ip_forward = 1` on Linux).

### Route Conflicts

When unexpected routing occurs:

1. **Check effective routes** on the affected VM's NIC:

   ```bash
   az network nic show-effective-route-table -g MyRG -n VM-NIC -o table
   ```

2. **Identify conflicting sources.** Look for overlapping prefixes from different sources (UDR, BGP, system).

3. **Apply precedence rules:** UDR beats BGP for the same prefix. Longest prefix match wins across sources.

4. **Check Route Server learned routes** to understand what the NVA is advertising:

   ```bash
   az network routeserver peering list-learned-routes -g MyRG \
     --routeserver MyRouteServer -n NVAPeer1
   ```

5. **Check Route Server advertised routes** to understand what the NVA is receiving:

   ```bash
   az network routeserver peering list-advertised-routes -g MyRG \
     --routeserver MyRouteServer -n NVAPeer1
   ```

### Common Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| IP forwarding not enabled on NVA NIC | Traffic dropped by Azure fabric | Enable IP forwarding on NVA NIC |
| NVA only peers with one Route Server IP | Partial route coverage, failover gap | Peer with both Route Server instance IPs |
| NVA advertises 0.0.0.0/0 without subnet-level UDR overrides | Breaks Azure Bastion, App Gateway, other PaaS | Add UDR with Internet next-hop on affected subnets |
| Spoke peering missing "Use Remote Gateways" | Spoke VMs don't learn Route Server routes | Enable gateway transit on both sides of peering |
| NVA using ASN 65515 | BGP peering never establishes | Change NVA ASN to a different value (64512–65514 recommended) |
| NSG on RouteServerSubnet blocking TCP 179 | BGP peering cannot establish | Allow TCP 179 inbound/outbound on RouteServerSubnet NSG |
| NVA OS-level forwarding disabled | Packets arrive at NVA but are dropped by OS | Enable `ip_forward` (Linux) or routing role (Windows) |
