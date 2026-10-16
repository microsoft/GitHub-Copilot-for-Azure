# Azure Landing Zone Networking

Network topology and design guidance for Azure landing zones following the Cloud Adoption Framework (CAF) enterprise-scale architecture.

## Landing Zone Network Architecture Overview

The Azure landing zone architecture separates networking into a **connectivity subscription** that hosts shared networking resources, with application **landing zone subscriptions** hosting workloads in spoke VNets.

```
Management Group Hierarchy
├── Platform
│   ├── Connectivity (subscription)
│   │   ├── Hub VNet or Virtual WAN
│   │   ├── VPN/ExpressRoute Gateways
│   │   ├── Azure Firewall
│   │   ├── DNS (Private Resolver, Private DNS Zones)
│   │   └── Azure Bastion
│   ├── Identity (subscription)
│   │   └── AD DS / Entra DS VMs
│   └── Management (subscription)
│       └── Log Analytics, Automation
└── Landing Zones
    ├── Corp (connected to hub)
    │   ├── App1-subscription → Spoke VNet → Peered to Hub
    │   └── App2-subscription → Spoke VNet → Peered to Hub
    └── Online (internet-facing)
        └── WebApp-subscription → Spoke VNet → Peered to Hub
```

## Connectivity Subscription Design

The connectivity subscription is the networking backbone. All shared networking resources live here.

### Option A: Hub VNet with VNet Peering

Best for organizations with < 30 spokes and networking expertise.

```bash
# Create connectivity subscription resources
az network vnet create \
  -g connectivity-rg \
  -n hub-vnet \
  --address-prefix 10.0.0.0/22 \
  --location <primary-region>

# Gateway subnet for VPN/ExpressRoute
az network vnet subnet create \
  -g connectivity-rg \
  --vnet-name hub-vnet \
  -n GatewaySubnet \
  --address-prefix 10.0.0.0/27

# Firewall subnet
az network vnet subnet create \
  -g connectivity-rg \
  --vnet-name hub-vnet \
  -n AzureFirewallSubnet \
  --address-prefix 10.0.0.64/26

# Bastion subnet
az network vnet subnet create \
  -g connectivity-rg \
  --vnet-name hub-vnet \
  -n AzureBastionSubnet \
  --address-prefix 10.0.0.128/26
```

### Option B: Azure Virtual WAN

Best for organizations with 30+ spokes, multiple branches, or wanting managed routing.

```bash
# Create Virtual WAN
az network vwan create \
  -g connectivity-rg \
  -n enterprise-vwan \
  --type Standard \
  --location <primary-region>

# Create Virtual WAN Hub
az network vhub create \
  -g connectivity-rg \
  -n hub-<region> \
  --vwan enterprise-vwan \
  --address-prefix 10.0.0.0/23 \
  --location <primary-region>
```

### Decision: Hub VNet vs Virtual WAN

| Factor | Hub VNet | Virtual WAN |
|--------|----------|-------------|
| Number of spokes | < 30 | 30+ |
| Branch offices with SD-WAN | Not integrated | Integrated partner support |
| Routing complexity | Manual UDRs | Managed by Virtual WAN |
| NVA flexibility | Full control | Limited to integrated partners |
| Cost predictability | Pay per resource | Hub fee + routing charges |
| Migration from existing | Easier (familiar patterns) | Requires architectural change |

## Hub VNet Services

### Azure Firewall

Central inspection and filtering point for all traffic:

```bash
# Create Azure Firewall in hub
az network firewall create \
  -g connectivity-rg \
  -n hub-firewall \
  --location <region> \
  --sku AZFW_VNet \
  --tier Premium \
  --vnet-name hub-vnet

# Create firewall policy (centrally managed)
az network firewall policy create \
  -g connectivity-rg \
  -n enterprise-fw-policy \
  --sku Premium \
  --threat-intel-mode Deny
```

### VPN/ExpressRoute Gateway

```bash
# Create ExpressRoute Gateway (if using ExpressRoute)
az network vnet-gateway create \
  -g connectivity-rg \
  -n er-gateway \
  --vnet hub-vnet \
  --gateway-type ExpressRoute \
  --sku ErGw2AZ \
  --location <region>

# Create VPN Gateway (if using VPN, or as backup for ER)
az network vnet-gateway create \
  -g connectivity-rg \
  -n vpn-gateway \
  --vnet hub-vnet \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw2AZ \
  --location <region>
```

### DNS Architecture

Centralize DNS in the connectivity subscription:

```bash
# Create DNS Private Resolver in hub
az dns-resolver create \
  -g connectivity-rg \
  -n hub-dns-resolver \
  --location <region> \
  --id /subscriptions/<sub>/resourceGroups/connectivity-rg/providers/Microsoft.Network/virtualNetworks/hub-vnet

# Create Private DNS zones for Azure services (link to hub VNet)
for zone in privatelink.blob.core.windows.net privatelink.database.windows.net privatelink.vaultcore.azure.net; do
  az network private-dns zone create -g connectivity-rg -n $zone
  az network private-dns link vnet create \
    -g connectivity-rg \
    -z $zone \
    -n hub-link \
    --virtual-network hub-vnet \
    --registration-enabled false
done
```

**Critical DNS design decisions:**
- Private DNS zones should be in the **connectivity subscription** (not in each workload subscription)
- All VNets (hub + spokes) must be linked to the Private DNS zones
- On-premises DNS servers forward Azure zones to the DNS Private Resolver inbound endpoint
- Use DNS forwarding rulesets for Azure-to-on-premises resolution

## Application Landing Zone Networking

Each application team gets a subscription with a spoke VNet peered to the hub.

### Spoke VNet template

```bash
# Create spoke VNet in the application subscription
az network vnet create \
  -g <app-rg> \
  -n spoke-<app-name> \
  --address-prefix 10.1.0.0/24 \
  --location <region>

# Create workload subnets
az network vnet subnet create \
  -g <app-rg> \
  --vnet-name spoke-<app-name> \
  -n web-subnet \
  --address-prefix 10.1.0.0/26

az network vnet subnet create \
  -g <app-rg> \
  --vnet-name spoke-<app-name> \
  -n app-subnet \
  --address-prefix 10.1.0.64/26

az network vnet subnet create \
  -g <app-rg> \
  --vnet-name spoke-<app-name> \
  -n data-subnet \
  --address-prefix 10.1.0.128/26

# Peer to hub (cross-subscription peering)
az network vnet peering create \
  -g <app-rg> \
  --name spoke-to-hub \
  --vnet-name spoke-<app-name> \
  --remote-vnet /subscriptions/<connectivity-sub>/resourceGroups/connectivity-rg/providers/Microsoft.Network/virtualNetworks/hub-vnet \
  --allow-vnet-access \
  --allow-forwarded-traffic \
  --use-remote-gateways
```

### Apply governance: route all traffic through firewall

```bash
# Create route table for the spoke
az network route-table create -g <app-rg> -n spoke-rt --location <region>

# Default route through hub firewall
az network route-table route create \
  -g <app-rg> \
  --route-table-name spoke-rt \
  -n to-firewall \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <firewall-private-ip>

# Associate with all workload subnets
az network vnet subnet update -g <app-rg> --vnet-name spoke-<app-name> -n web-subnet --route-table spoke-rt
az network vnet subnet update -g <app-rg> --vnet-name spoke-<app-name> -n app-subnet --route-table spoke-rt
az network vnet subnet update -g <app-rg> --vnet-name spoke-<app-name> -n data-subnet --route-table spoke-rt
```

### Private DNS zone links for spoke VNets

```bash
# Link spoke VNet to all Private DNS zones in connectivity subscription
for zone in privatelink.blob.core.windows.net privatelink.database.windows.net privatelink.vaultcore.azure.net; do
  az network private-dns link vnet create \
    -g connectivity-rg \
    -z $zone \
    -n spoke-<app-name>-link \
    --virtual-network /subscriptions/<app-sub>/resourceGroups/<app-rg>/providers/Microsoft.Network/virtualNetworks/spoke-<app-name> \
    --registration-enabled false
done
```

## Multi-Region Landing Zone

For disaster recovery and global presence, deploy hub infrastructure in multiple regions:

- **Primary region:** Full hub (Firewall + Gateway + DNS + Bastion)
- **Secondary region:** Full hub (Firewall + Gateway + DNS + Bastion)
- **Hub-to-hub:** Global VNet peering or ExpressRoute Global Reach
- **DNS:** Consistent across regions (same Private DNS zones linked to both hubs)
- **Firewall Policy:** Use Azure Firewall Manager for central policy across regions

## Platform vs Application Landing Zone Responsibilities

| Responsibility | Platform Team | Application Team |
|---------------|:-------------:|:----------------:|
| Hub VNet design | ✅ | |
| Firewall rules (network level) | ✅ | |
| VPN/ExpressRoute configuration | ✅ | |
| DNS zone management | ✅ | |
| Spoke VNet creation | ✅ (or delegated) | |
| NSG rules within spoke | | ✅ |
| Application Gateway in spoke | | ✅ |
| Private endpoints | | ✅ |
| Workload deployment | | ✅ |

## Landing Zone Networking Checklist

- [ ] Connectivity subscription created with hub VNet or Virtual WAN
- [ ] Azure Firewall deployed with baseline policy (deny all, allow known traffic)
- [ ] VPN and/or ExpressRoute gateway deployed and connected
- [ ] DNS Private Resolver deployed with forwarding rules
- [ ] Private DNS zones created for all required Azure services
- [ ] Azure Bastion deployed in hub for management access
- [ ] IP address plan finalized — no overlaps between hub, spokes, and on-premises
- [ ] Azure Policy to enforce NSGs on all subnets
- [ ] Azure Policy to enforce UDRs directing traffic through firewall
- [ ] Network Watcher enabled in all regions
- [ ] NSG flow logs enabled and sent to Log Analytics

## Related Resources

- [CAF enterprise-scale landing zone](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/)
- [Define an Azure network topology](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/define-an-azure-network-topology)
- [Hub-spoke topology](https://learn.microsoft.com/azure/architecture/networking/architecture/hub-spoke)
- For hub-spoke design details → see [hub-spoke-design.md](hub-spoke-design.md)
- For IP planning → see [ip-planning.md](ip-planning.md)
- For segmentation → see [segmentation.md](segmentation.md)
