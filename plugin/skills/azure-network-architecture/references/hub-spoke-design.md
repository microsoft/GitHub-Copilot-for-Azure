# Hub-and-Spoke Network Design

Guide for designing hub-and-spoke network topologies in Azure using VNet peering or Azure Virtual WAN.

## Architecture Overview

Hub-and-spoke is the recommended topology for most Azure deployments. A central **hub VNet** hosts shared services (firewall, VPN/ExpressRoute gateway, DNS). **Spoke VNets** host workloads and peer with the hub.

```
                    On-Premises
                        │
                  VPN / ExpressRoute
                        │
               ┌────────┴────────┐
               │    Hub VNet     │
               │  ┌───────────┐  │
               │  │ Firewall  │  │
               │  │ Gateway   │  │
               │  │ DNS       │  │
               │  │ Bastion   │  │
               │  └───────────┘  │
               └───┬────┬────┬───┘
                   │    │    │
            Peering│    │    │Peering
                   │    │    │
            ┌──────┘    │    └──────┐
            ▼           ▼           ▼
       ┌─────────┐ ┌─────────┐ ┌─────────┐
       │ Spoke 1 │ │ Spoke 2 │ │ Spoke 3 │
       │ (Web)   │ │ (App)   │ │ (Data)  │
       └─────────┘ └─────────┘ └─────────┘
```

## VNet Peering Hub-Spoke vs Virtual WAN

| Criteria | VNet Peering Hub-Spoke | Azure Virtual WAN |
|----------|----------------------|-------------------|
| **Best for** | < 30 spokes, full routing control | 30+ spokes, managed routing, branch connectivity |
| **Hub management** | You manage the hub VNet and all resources | Microsoft manages the hub infrastructure |
| **Transitive routing** | Requires NVA/Firewall + UDRs | Built-in transitive routing |
| **Spoke-to-spoke** | Only through hub NVA (UDRs required) | Automatic via Virtual WAN hub router |
| **On-premises connectivity** | VPN/ER Gateway in hub, gateway transit | Integrated VPN/ER in Virtual WAN hub |
| **Cost** | Pay for individual resources | Hub + routing fee + individual resources |
| **Complexity** | Higher (manage UDRs, peering, NVA HA) | Lower (managed routing and HA) |
| **Customization** | Full control over routing and NVA placement | Less control, follows Virtual WAN routing model |
| **Multi-region** | Peer hub VNets across regions + manage routing | Global transit via interconnected hubs |

**Decision guide:**
- Choose **VNet peering** if you need full control, have < 30 spokes, and have networking expertise to manage UDRs
- Choose **Virtual WAN** if you have many branches, 30+ spokes, want managed routing, or need rapid multi-region deployment

## Designing the Hub VNet

### Hub VNet sizing

Plan subnets for all shared services. Minimum recommended hub VNet size: `/22` (1,019 usable IPs).

| Subnet | Purpose | Recommended Size | Notes |
|--------|---------|-----------------|-------|
| GatewaySubnet | VPN/ER Gateway | /27 minimum | Name must be exactly "GatewaySubnet" |
| AzureFirewallSubnet | Azure Firewall | /26 minimum | Name must be exactly "AzureFirewallSubnet" |
| AzureFirewallManagementSubnet | Firewall forced tunneling | /26 | Required if using forced tunneling |
| AzureBastionSubnet | Azure Bastion | /26 minimum | Name must be exactly "AzureBastionSubnet" |
| dns-inbound | DNS Private Resolver inbound | /28 | Dedicated subnet, no other resources |
| dns-outbound | DNS Private Resolver outbound | /28 | Dedicated subnet, no other resources |
| shared-services | Jump boxes, AD DS, monitoring | /24 | Size based on number of shared VMs |

```bash
# Create hub VNet
az network vnet create \
  --resource-group hub-rg \
  --name hub-vnet \
  --address-prefix 10.0.0.0/22 \
  --location eastus

# Create hub subnets
az network vnet subnet create -g hub-rg --vnet-name hub-vnet -n GatewaySubnet --address-prefix 10.0.0.0/27
az network vnet subnet create -g hub-rg --vnet-name hub-vnet -n AzureFirewallSubnet --address-prefix 10.0.0.64/26
az network vnet subnet create -g hub-rg --vnet-name hub-vnet -n AzureBastionSubnet --address-prefix 10.0.0.128/26
az network vnet subnet create -g hub-rg --vnet-name hub-vnet -n shared-services --address-prefix 10.0.1.0/24
```

### Spoke VNet sizing

Each spoke VNet typically gets a `/24` to `/20` depending on workload size. See [ip-planning.md](ip-planning.md) for detailed CIDR guidance.

## Setting Up Peering

### Hub-to-spoke peering (with gateway transit)

```bash
# Create peering from hub to spoke (allow gateway transit)
az network vnet peering create \
  --resource-group hub-rg \
  --name hub-to-spoke1 \
  --vnet-name hub-vnet \
  --remote-vnet /subscriptions/<sub>/resourceGroups/spoke1-rg/providers/Microsoft.Network/virtualNetworks/spoke1-vnet \
  --allow-vnet-access \
  --allow-forwarded-traffic \
  --allow-gateway-transit

# Create peering from spoke to hub (use remote gateway)
az network vnet peering create \
  --resource-group spoke1-rg \
  --name spoke1-to-hub \
  --vnet-name spoke1-vnet \
  --remote-vnet /subscriptions/<sub>/resourceGroups/hub-rg/providers/Microsoft.Network/virtualNetworks/hub-vnet \
  --allow-vnet-access \
  --allow-forwarded-traffic \
  --use-remote-gateways
```

### Spoke-to-spoke routing through the hub firewall

Spokes cannot communicate directly through peering. Route traffic through the hub firewall:

```bash
# Create route table for spoke subnets
az network route-table create -g spoke1-rg -n spoke1-rt --location eastus

# Route all non-local traffic to the hub firewall
az network route-table route create \
  -g spoke1-rg \
  --route-table-name spoke1-rt \
  --name to-hub-firewall \
  --address-prefix 10.0.0.0/8 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <firewall-private-ip>

# Route internet traffic through firewall (optional, for inspection)
az network route-table route create \
  -g spoke1-rg \
  --route-table-name spoke1-rt \
  --name internet-via-firewall \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <firewall-private-ip>

# Associate route table with spoke subnet
az network vnet subnet update \
  -g spoke1-rg \
  --vnet-name spoke1-vnet \
  --name workload-subnet \
  --route-table spoke1-rt
```

## Transitive Routing Options

When using VNet peering (not Virtual WAN), transitive routing requires explicit configuration:

| Approach | Complexity | Performance | Cost |
|----------|-----------|-------------|------|
| Azure Firewall in hub | Medium | High (stateful, logged) | Firewall cost |
| NVA in hub (e.g., Palo Alto) | High | Varies by NVA | NVA + VM cost |
| Azure Route Server + NVA | Medium | High (BGP dynamic routing) | Route Server + NVA cost |
| VNet Manager mesh | Low | Highest (direct peering) | VNet Manager fee |

### Using Azure Virtual Network Manager for spoke mesh

For spoke-to-spoke traffic that doesn't need firewall inspection:

```bash
# Create a network group with spokes
az network manager group create \
  --resource-group <rg> \
  --network-manager-name <manager> \
  --name spoke-group

# Create a mesh connectivity configuration
az network manager connect-config create \
  --resource-group <rg> \
  --network-manager-name <manager> \
  --name mesh-config \
  --applies-to-group "[{networkGroupId:<group-id>, useHubGateway:true, groupConnectivity:DirectlyConnected}]" \
  --connectivity-topology Mesh
```

## NVA Placement in the Hub

If using a third-party NVA instead of Azure Firewall:

- Deploy the NVA in a **dedicated subnet** in the hub
- Enable **IP forwarding** on the NVA NIC
- Place NVAs behind an **Internal Load Balancer** (Standard SKU, HA ports) for high availability
- Use **two-NIC NVAs** (inside/outside) for security separation
- Set UDRs on all spoke subnets pointing to the ILB frontend IP

```bash
# Enable IP forwarding on NVA NIC
az network nic update -g hub-rg -n nva-nic --ip-forwarding true

# Create internal load balancer for NVA HA
az network lb create \
  -g hub-rg -n nva-ilb \
  --sku Standard \
  --vnet-name hub-vnet \
  --subnet nva-subnet \
  --frontend-ip-name nva-frontend \
  --backend-pool-name nva-pool

# Enable HA ports (all ports, all protocols)
az network lb rule create \
  -g hub-rg --lb-name nva-ilb \
  -n ha-ports-rule \
  --protocol All \
  --frontend-port 0 \
  --backend-port 0 \
  --frontend-ip-name nva-frontend \
  --backend-pool-name nva-pool
```

## Multi-Region Hub-Spoke

For multi-region deployments, create a hub in each region and peer them:

```bash
# Peer hub VNets across regions (global peering)
az network vnet peering create \
  -g hub-eastus-rg \
  --name hub-eastus-to-hub-westus \
  --vnet-name hub-eastus-vnet \
  --remote-vnet /subscriptions/<sub>/resourceGroups/hub-westus-rg/providers/Microsoft.Network/virtualNetworks/hub-westus-vnet \
  --allow-vnet-access \
  --allow-forwarded-traffic \
  --allow-gateway-transit
```

**Key considerations:**
- Global VNet peering traffic is charged at inter-region rates
- Each hub needs its own gateway for on-premises connectivity (or use ExpressRoute Global Reach)
- DNS must be consistent across regions
- Firewall rules should be managed centrally (use Azure Firewall Manager or Firewall Policy)

## Design Checklist

- [ ] Hub VNet sized with room for all shared services subnets
- [ ] Spoke VNet address spaces do not overlap with hub or each other
- [ ] Peering configured with gateway transit and forwarded traffic
- [ ] UDRs on spoke subnets route traffic through hub firewall
- [ ] DNS configured (Private DNS zones linked to hub, DNS forwarding for on-premises)
- [ ] NSGs on all subnets with default-deny inbound
- [ ] Azure Bastion in hub for secure management access
- [ ] Network Watcher enabled in all regions

## Related Resources

- [Hub-spoke network topology in Azure](https://learn.microsoft.com/azure/architecture/networking/architecture/hub-spoke)
- [Virtual WAN overview](https://learn.microsoft.com/azure/virtual-wan/virtual-wan-about)
- [Azure Virtual Network Manager overview](https://learn.microsoft.com/azure/virtual-network-manager/overview)
- For IP planning → see [ip-planning.md](ip-planning.md)
- For segmentation → see [segmentation.md](segmentation.md)
- For Virtual WAN configuration → use `azure-virtual-wan` skill
