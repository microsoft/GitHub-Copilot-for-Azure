# Next Hop

Next hop is a Network Watcher diagnostic that determines the next hop type and IP address for traffic from a VM to a specified destination. It is the primary tool for diagnosing routing issues, verifying UDR (User-Defined Route) configurations, and identifying why traffic is being routed unexpectedly.

## How It Works

Next hop queries the effective routes for a VM's network interface and returns:

1. **Next hop type** — the type of Azure resource or routing mechanism that handles the packet
2. **Next hop IP address** — the IP address of the next hop (if applicable)
3. **Route table ID** — the route table that contains the matching route

Azure evaluates routes using longest prefix match. When multiple routes match a destination, the most specific route wins. Next hop shows you exactly which route is selected.

## Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `--vm` | Source VM name | `myVM` |
| `--resource-group` | Resource group of the VM | `myRG` |
| `--source-ip` | Source IP address (must be an IP on the VM's NIC) | `10.0.0.4` |
| `--dest-ip` | Destination IP address | `10.1.0.4` |

## CLI Usage

### Basic next hop check

```bash
az network watcher show-next-hop \
  --resource-group myRG \
  --vm myVM \
  --source-ip 10.0.0.4 \
  --dest-ip 10.1.0.4
```

**Example output:**
```json
{
  "nextHopIpAddress": "",
  "nextHopType": "VnetPeering",
  "routeTableId": "System Route"
}
```

### Check route to the internet

```bash
az network watcher show-next-hop \
  --resource-group myRG \
  --vm myVM \
  --source-ip 10.0.0.4 \
  --dest-ip 8.8.8.8
```

### Check route to an on-premises network

```bash
az network watcher show-next-hop \
  --resource-group myRG \
  --vm myVM \
  --source-ip 10.0.0.4 \
  --dest-ip 192.168.1.10
```

### Check route to a specific Azure service

```bash
az network watcher show-next-hop \
  --resource-group myRG \
  --vm myVM \
  --source-ip 10.0.0.4 \
  --dest-ip 52.239.228.100
```

## Next Hop Types

| Next Hop Type | Description |
|---------------|-------------|
| `VirtualNetwork` | Destination is within the VNet's address space (including peered VNets with `VnetPeering`) |
| `VnetPeering` | Traffic routes via VNet peering to a peered virtual network |
| `VirtualNetworkGateway` | Traffic routes through a VPN Gateway or ExpressRoute Gateway |
| `Internet` | Traffic routes to the internet via Azure's default route |
| `VirtualAppliance` | Traffic routes to a Network Virtual Appliance (NVA) via a UDR — the next hop IP is the NVA's IP |
| `None` | Traffic is dropped (black-holed) — destination is unreachable |
| `VnetLocal` | Traffic stays within the same subnet |

## Interpreting Results

### Expected: Traffic routes within the VNet

```json
{
  "nextHopIpAddress": "",
  "nextHopType": "VirtualNetwork",
  "routeTableId": "System Route"
}
```

Traffic uses the default system route to reach destinations within the VNet address space.

### Expected: Traffic routes through an NVA

```json
{
  "nextHopIpAddress": "10.0.2.4",
  "nextHopType": "VirtualAppliance",
  "routeTableId": "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/routeTables/myRouteTable"
}
```

A UDR in `myRouteTable` directs traffic to the NVA at `10.0.2.4`.

### Unexpected: Traffic is black-holed

```json
{
  "nextHopIpAddress": "",
  "nextHopType": "None",
  "routeTableId": "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/routeTables/myRouteTable"
}
```

A `None` next hop means the traffic is dropped. Common causes:
- A UDR pointing to a non-existent next hop IP
- A UDR with an address prefix that catches traffic unintentionally
- IP forwarding not enabled on the NVA's NIC

### Unexpected: Traffic goes to the internet instead of a VPN

```json
{
  "nextHopIpAddress": "",
  "nextHopType": "Internet",
  "routeTableId": "System Route"
}
```

If you expected traffic to route through a VPN gateway to an on-premises network, this means:
- BGP routes from the gateway are not propagating
- Route propagation is disabled on the subnet's route table
- The on-premises address prefix is not advertised via BGP

## Diagnostic Scenarios

### Scenario 1: VM cannot reach a peered VNet

```bash
az network watcher show-next-hop \
  --resource-group myRG --vm vmA \
  --source-ip 10.0.0.4 --dest-ip 10.1.0.4
```

If next hop type is `None`: the peering may be broken or the remote VNet address space changed. Check:
- Peering status on both sides (must be "Connected")
- Remote VNet address space includes the destination IP

If next hop type is `Internet`: the destination IP is not recognized as part of any VNet. Verify the VNet address spaces.

### Scenario 2: Traffic should route through a firewall NVA but doesn't

```bash
az network watcher show-next-hop \
  --resource-group myRG --vm appVM \
  --source-ip 10.0.1.4 --dest-ip 8.8.8.8
```

If next hop type is `Internet` instead of `VirtualAppliance`:
- The UDR `0.0.0.0/0 -> NVA IP` is not applied to the VM's subnet
- The route table is not associated with the subnet
- A more specific route is overriding the UDR

Verify with:
```bash
# Show effective routes on the VM's NIC
az network nic show-effective-route-table \
  --resource-group myRG \
  --name myVM-nic \
  --output table
```

### Scenario 3: Asymmetric routing suspected

Test next hop from both VMs:

```bash
# Forward path: VM-A to VM-B
az network watcher show-next-hop \
  --resource-group myRG --vm vmA \
  --source-ip 10.0.0.4 --dest-ip 10.1.0.4

# Return path: VM-B to VM-A
az network watcher show-next-hop \
  --resource-group myRG --vm vmB \
  --source-ip 10.1.0.4 --dest-ip 10.0.0.4
```

If the forward path routes through an NVA but the return path does not, you have asymmetric routing. The NVA may drop the return traffic because it did not see the original flow.

### Scenario 4: Verifying route table correctness

After creating or modifying a UDR, verify it takes effect:

```bash
# Expected: traffic to 10.2.0.0/16 should go through NVA at 10.0.2.4
az network watcher show-next-hop \
  --resource-group myRG --vm myVM \
  --source-ip 10.0.0.4 --dest-ip 10.2.0.10
```

If the result shows the NVA IP as the next hop, the UDR is working. If not, check:
- Route table is associated with the correct subnet
- UDR address prefix matches the destination
- No higher-priority route is overriding it

## Effective Routes vs Next Hop

| Tool | Use When |
|------|----------|
| **Next hop** | Quick answer: where does traffic to a specific destination go? |
| **Effective routes** (`az network nic show-effective-route-table`) | Full view of all routes on a NIC, for comprehensive route table analysis |

Next hop queries the effective routes under the hood but returns only the winning route for a single destination.

## Limitations

- Source IP must be assigned to the VM's NIC
- Only evaluates the source VM's routing — does not test the return path
- Does not evaluate NSG rules (use IP flow verify for that)
- Cannot test from non-VM resources (e.g., Azure Firewall, Application Gateway)
- The VM must be in a running state

## Learn More

- [Next hop overview — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/next-hop-overview)
- [Diagnose VM routing problems — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/diagnose-vm-network-routing-problem)
- [Virtual network traffic routing — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network/virtual-networks-udr-overview)
