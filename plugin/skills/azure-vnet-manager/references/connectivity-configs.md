# Connectivity Configurations

Connectivity configurations in Azure Virtual Network Manager (AVNM) define the topology between VNets in a network group. They automate peering creation and ongoing management, replacing manual VNet peering at scale.

## Topology Types

AVNM supports two connectivity topologies:

| Topology | Description | Peering Pattern |
|----------|-------------|-----------------|
| **Hub-and-spoke** | Spoke VNets peer to a central hub VNet | Star topology — spokes connect to hub, not to each other (unless direct connectivity is enabled) |
| **Mesh** | All VNets in the group peer directly with each other | Full mesh — every VNet can communicate directly with every other VNet |

## Hub-and-Spoke Topology

Hub-and-spoke is the most common enterprise topology. Spoke VNets route traffic through a central hub for shared services (firewall, VPN gateway, DNS).

### Creating a hub-and-spoke configuration

```bash
az network manager connect-config create \
  --name hubSpokeConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "HubAndSpoke" \
  --hub resource-id="/subscriptions/{sub}/resourceGroups/hubRG/providers/Microsoft.Network/virtualNetworks/hubVNet" resource-type="Microsoft.Network/virtualNetworks" \
  --applies-to-groups group-connectivity="None" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/spokeGroup" use-hub-gateway="False"
```

### Hub requirements

- The hub VNet must be within the network manager's scope
- The hub VNet does not need to be in the network group — it is specified separately in the configuration
- Only one hub VNet per hub-and-spoke configuration

### Direct connectivity between spokes

By default, spoke VNets communicate through the hub. Enable direct connectivity to allow spokes to reach each other without transiting the hub:

```bash
az network manager connect-config create \
  --name hubSpokeWithDirect \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "HubAndSpoke" \
  --hub resource-id="/subscriptions/{sub}/resourceGroups/hubRG/providers/Microsoft.Network/virtualNetworks/hubVNet" resource-type="Microsoft.Network/virtualNetworks" \
  --applies-to-groups group-connectivity="DirectlyConnected" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/spokeGroup" use-hub-gateway="False"
```

Setting `group-connectivity="DirectlyConnected"` creates peering between all spokes in the group in addition to the hub-to-spoke peering.

### Using the hub as a gateway

If the hub VNet has a VPN or ExpressRoute gateway, spokes can use it for on-premises connectivity:

```bash
az network manager connect-config create \
  --name hubSpokeWithGateway \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "HubAndSpoke" \
  --hub resource-id="/subscriptions/{sub}/resourceGroups/hubRG/providers/Microsoft.Network/virtualNetworks/hubVNet" resource-type="Microsoft.Network/virtualNetworks" \
  --applies-to-groups group-connectivity="None" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/spokeGroup" use-hub-gateway="True"
```

This sets `useRemoteGateways=true` on the spoke peering and `allowGatewayTransit=true` on the hub peering, equivalent to manual gateway transit configuration.

## Mesh Topology

Mesh topology creates direct peering between all VNets in a group. Every VNet can communicate with every other VNet without routing through a hub.

### Creating a mesh configuration

```bash
az network manager connect-config create \
  --name meshConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "Mesh" \
  --applies-to-groups group-connectivity="DirectlyConnected" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/appGroup" is-global="False"
```

### Regional vs global mesh

| Setting | Description | Cost |
|---------|-------------|------|
| `is-global="False"` | Mesh only between VNets in the same region | Regional peering rates (often free for data transfer within a region) |
| `is-global="True"` | Mesh across all regions | Global peering rates (cross-region data transfer charges apply) |

```bash
# Create a global mesh
az network manager connect-config create \
  --name globalMesh \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "Mesh" \
  --applies-to-groups group-connectivity="DirectlyConnected" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/appGroup" is-global="True"
```

### When to use mesh

- All VNets need direct communication (no shared services hub needed)
- Workloads require low-latency direct paths between VNets
- Small to medium number of VNets (consider peering limits)
- Microservices or distributed applications spread across VNets

## Choosing Between Topologies

| Factor | Hub-and-Spoke | Mesh |
|--------|---------------|------|
| Central firewall/NVA | Yes — route through hub | No central point (must use security admin rules or per-VNet NVAs) |
| Shared VPN/ER gateway | Yes — use hub gateway | No shared gateway |
| VNet-to-VNet latency | Higher (transits hub) | Lower (direct peering) |
| Scalability | Very high (spokes only peer to hub) | Limited by peering count (500 peerings per VNet) |
| Management complexity | Lower | Higher for large groups |
| Spoke-to-spoke communication | Requires NVA/firewall or direct connectivity option | Built-in |

## Multiple Network Groups

A connectivity configuration can reference multiple network groups. Different groups can have different settings:

```bash
# Hub-and-spoke with two spoke groups, one with direct connectivity
az network manager connect-config create \
  --name multiGroupConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "HubAndSpoke" \
  --hub resource-id="/subscriptions/{sub}/resourceGroups/hubRG/providers/Microsoft.Network/virtualNetworks/hubVNet" resource-type="Microsoft.Network/virtualNetworks" \
  --applies-to-groups \
    group-connectivity="DirectlyConnected" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/webGroup" use-hub-gateway="False" \
    group-connectivity="None" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/dataGroup" use-hub-gateway="True"
```

In this example, web VNets can communicate directly, while data VNets only route through the hub and use its gateway.

## Managing Connectivity Configurations

```bash
# List connectivity configurations
az network manager connect-config list \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# Show a specific configuration
az network manager connect-config show \
  --name hubSpokeConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG

# Delete a configuration (must not be deployed)
az network manager connect-config delete \
  --name hubSpokeConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --yes
```

## Important Considerations

1. **Peering limits** — each VNet supports up to 500 peerings. In a mesh with N VNets, each VNet has N-1 peerings. A group of 100 VNets means 99 peerings per VNet.
2. **Address space overlap** — VNets with overlapping address spaces cannot be peered. AVNM will fail to deploy if overlaps exist.
3. **Existing peerings** — AVNM-managed peerings coexist with manually created peerings. If a manual peering already exists between two VNets, AVNM takes over management of that peering.
4. **Configuration changes require redeployment** — modifying a configuration does not automatically apply changes. You must commit and deploy again.
5. **One connectivity configuration per VNet** — a VNet should not be a spoke in two different hub-and-spoke configurations simultaneously.

## Learn More

- [Connectivity configuration overview — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/concept-connectivity-configuration)
- [Create a hub-and-spoke topology — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/how-to-create-hub-and-spoke)
- [Create a mesh topology — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/how-to-create-mesh-network-topology)
