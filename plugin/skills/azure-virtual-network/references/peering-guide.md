# VNet Peering Guide

## Overview

VNet peering connects two Azure Virtual Networks, enabling resources in both VNets to communicate using private IP addresses as if they were on the same network. Peered traffic travels over the Microsoft backbone network — it never traverses the public internet.

Peering must be configured in **both directions** — you create a peering link from VNet A to VNet B, and a second link from VNet B to VNet A. Until both sides are configured, the peering is not functional.

## Regional vs Global Peering

| Feature | Regional Peering | Global Peering |
|---------|-----------------|----------------|
| VNet location | Same Azure region | Different Azure regions |
| Latency | Sub-millisecond (same as intra-VNet) | Cross-region latency (varies by distance) |
| Bandwidth | No limit (same region backbone) | Limited by VM SKU egress limits |
| Cost | Ingress and egress charged per GB | Higher per-GB rate than regional |
| Basic Load Balancer | Accessible across peering | **NOT accessible** across global peering |
| Standard Load Balancer | Accessible | Accessible |
| VNet encryption | Supported | Supported (if both VNets enable it) |
| Gateway transit | Supported | Supported |

> **Important**: If you use Basic Load Balancers, they are not reachable over global peering. Upgrade to Standard SKU for cross-region scenarios.

## Peering States

A peering connection goes through the following states:

| State | Meaning |
|-------|---------|
| **Initiated** | Peering created on one side only. Traffic cannot flow. |
| **Connected** | Peering created on both sides. Traffic flows bidirectionally. |
| **Disconnected** | One side deleted their peering link, or an address space change broke the peering. |

### State Transitions

```
VNet A creates peering → A: Initiated, B: (no peering yet)
VNet B creates peering → A: Connected, B: Connected
VNet A deletes peering → A: (deleted), B: Disconnected
```

Once a peering enters the **Disconnected** state, you must delete and recreate the peering on both sides. You cannot recover a disconnected peering by re-adding the link from one side.

## Transitivity

**VNet peering is NOT transitive.** If VNet A peers with VNet B, and VNet B peers with VNet C, VNet A cannot reach VNet C through VNet B — unless you explicitly configure routing.

### Achieving Transitive Routing

There are several approaches to enable spoke-to-spoke communication:

#### 1. Hub-Spoke with Azure Firewall or NVA

The hub VNet runs a firewall or NVA. Spoke VNets have UDRs that send traffic to the hub's firewall IP. The firewall routes traffic between spokes.

```
Spoke A → UDR → Hub (Azure Firewall) → UDR → Spoke B
```

This is the most common production pattern. It also enables traffic inspection and logging.

#### 2. Azure Virtual Network Manager (AVNM)

AVNM supports **connected groups** — a mesh topology where spokes can communicate directly without going through the hub. AVNM automates peering creation and manages routing.

```bash
# AVNM creates direct connectivity between group members
# No UDRs needed for spoke-to-spoke within a connected group
```

#### 3. VPN Gateway in Hub (Route-Based)

A VPN gateway in the hub with BGP can propagate routes between peered VNets. Less common for intra-Azure traffic but useful in hybrid scenarios.

## Gateway Transit

Gateway transit allows a peered VNet to use the other VNet's VPN or ExpressRoute gateway instead of deploying its own. This is common in hub-spoke designs where only the hub has a gateway.

### Configuration

On the **hub** (VNet with gateway):
- Enable **"Allow gateway transit"** on the peering link.

On the **spoke** (VNet without gateway):
- Enable **"Use remote gateways"** on the peering link.

```bash
# Hub side: allow gateway transit
az network vnet peering update -g HubRG -n HubToSpoke --vnet-name HubVNet \
  --allow-gateway-transit true

# Spoke side: use remote gateway
az network vnet peering update -g SpokeRG -n SpokeToHub --vnet-name SpokeVNet \
  --use-remote-gateways true
```

### Gateway Transit Rules

1. Only one VNet in the peering pair can have `allow-gateway-transit` enabled.
2. The spoke VNet **must not** have its own gateway to use `use-remote-gateways`.
3. Gateway transit works with both VPN and ExpressRoute gateways.
4. Routes learned by the hub gateway (via BGP) are automatically propagated to the spoke.
5. Gateway transit is supported across global peering.

## Requirements

### Address Space

- Peered VNets **must not** have overlapping address spaces.
- Even partial overlap (e.g., 10.0.0.0/16 and 10.0.1.0/24) is not allowed.
- If you need to change a VNet's address space, you may need to delete peering first, make the change, then recreate peering.

### Subscriptions and Tenants

Peering is supported across:
- VNets in the **same subscription**
- VNets in **different subscriptions** (same tenant)
- VNets in **different Azure AD tenants** (cross-tenant peering)

#### Cross-Subscription Peering Setup

```bash
# User with access to both subscriptions can create both peering links.
# If different users manage each subscription:

# Step 1: User A creates peering from VNet A to VNet B
# (User A needs Network Contributor on VNet A and Reader on VNet B)
az network vnet peering create \
  -g RG-A -n AtoB --vnet-name VNetA \
  --remote-vnet /subscriptions/{subB}/resourceGroups/{rgB}/providers/Microsoft.Network/virtualNetworks/VNetB \
  --allow-vnet-access

# Step 2: User B creates peering from VNet B to VNet A
# (User B needs Network Contributor on VNet B and Reader on VNet A)
az network vnet peering create \
  -g RG-B -n BtoA --vnet-name VNetB \
  --remote-vnet /subscriptions/{subA}/resourceGroups/{rgA}/providers/Microsoft.Network/virtualNetworks/VNetA \
  --allow-vnet-access
```

#### Required RBAC Permissions

| Action | Required Role |
|--------|--------------|
| Create peering on local VNet | Network Contributor (or custom with `Microsoft.Network/virtualNetworks/peer/action`) |
| Read remote VNet | Reader on the remote VNet (or custom with `Microsoft.Network/virtualNetworks/read`) |

## Peering Options

When creating a peering link, you can configure these settings:

| Option | Default | Purpose |
|--------|---------|---------|
| Allow virtual network access | Enabled | Allow traffic to flow between VNets |
| Allow forwarded traffic | Disabled | Allow traffic forwarded by an NVA in the peered VNet |
| Allow gateway transit | Disabled | Let the peered VNet use this VNet's gateway |
| Use remote gateways | Disabled | Use the peered VNet's gateway instead of a local one |

> **Common mistake**: Forgetting to enable **"Allow forwarded traffic"** when using a hub NVA or firewall. Without it, spoke-to-spoke traffic routed through the hub will be dropped.

## Limits

| Resource | Default Limit | Notes |
|----------|--------------|-------|
| Peerings per VNet | 500 | Hard limit — cannot be increased |
| Address spaces per peered VNet | 256 | Across all peered VNets combined |
| Address ranges advertised from hub (with gateway transit) | Varies by gateway SKU | Check VPN Gateway documentation |

## Troubleshooting

### Peering Stuck in "Initiated" State

**Symptom**: Peering shows as "Initiated" and traffic doesn't flow.
**Cause**: The peering link has only been created on one side.
**Fix**: Create the corresponding peering link from the other VNet. Both sides must have a peering link pointing to each other.

```bash
# Check peering state
az network vnet peering show -g MyRG -n MyPeering --vnet-name MyVNet --query peeringState
```

### Traffic Not Flowing Despite "Connected" State

**Symptom**: Peering is Connected but VMs cannot communicate.
**Causes**:
1. NSG rules blocking traffic between the VNets.
2. UDRs routing traffic away from the peering (e.g., to a firewall that drops it).
3. **"Allow virtual network access"** is disabled on one or both peering links.
4. **"Allow forwarded traffic"** is disabled when traffic is being forwarded through an NVA.

**Fix**:
```bash
# Check peering settings on both sides
az network vnet peering show -g RG-A --vnet-name VNetA -n AtoB \
  --query '{state:peeringState, allowVnetAccess:allowVirtualNetworkAccess, allowForwardedTraffic:allowForwardedTraffic}'

# Check effective routes on the VM's NIC
az network nic show-effective-route-table -g MyRG -n MyVM-NIC

# Check effective NSG rules
az network nic list-effective-nsg -g MyRG -n MyVM-NIC
```

### Asymmetric Peering Settings

**Symptom**: Traffic works in one direction but not the other.
**Cause**: Peering options differ between the two sides (e.g., forwarded traffic allowed on one side but not the other).
**Fix**: Review and align peering options on both VNets. For hub-spoke, ensure "Allow forwarded traffic" is enabled on the spoke-to-hub peering.

### Cannot Create Peering — Address Space Overlap

**Symptom**: Error stating address spaces overlap.
**Fix**: Remove the overlapping address space from one VNet. If both spaces are in use, you may need to re-IP one of the VNets.

```bash
# Check address spaces of both VNets
az network vnet show -g RG-A -n VNetA --query 'addressSpace.addressPrefixes'
az network vnet show -g RG-B -n VNetB --query 'addressSpace.addressPrefixes'
```

### Peering Disconnected After Address Change

**Symptom**: Peering shows as "Disconnected" after modifying a VNet's address space.
**Cause**: Changing address space on a peered VNet can break the peering link.
**Fix**: Delete peering on both sides, make address space changes, then recreate peering.

```bash
# Delete both peering links
az network vnet peering delete -g RG-A -n AtoB --vnet-name VNetA
az network vnet peering delete -g RG-B -n BtoA --vnet-name VNetB

# Modify address space
az network vnet update -g RG-A -n VNetA --address-prefixes 10.0.0.0/16 10.3.0.0/16

# Recreate peering on both sides
az network vnet peering create -g RG-A -n AtoB --vnet-name VNetA --remote-vnet {VNetB-ID} --allow-vnet-access
az network vnet peering create -g RG-B -n BtoA --vnet-name VNetB --remote-vnet {VNetA-ID} --allow-vnet-access
```
