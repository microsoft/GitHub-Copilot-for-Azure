# Cross-Region Load Balancer

## Overview

Cross-region Load Balancer provides **global Layer 4 load balancing** across Azure regions. It uses an anycast static public IP so clients are routed to the nearest healthy regional deployment. If a region fails, traffic automatically shifts to the next closest healthy region.

## Architecture

```
Clients (global)
    │
    ▼
Cross-region LB (global anycast IP)
    ├──► Regional LB (East US) → Backend VMs
    ├──► Regional LB (West Europe) → Backend VMs
    └──► Regional LB (Southeast Asia) → Backend VMs
```

### Key Architecture Points

- **Backend type**: Only regional **Standard public** Load Balancers can be backends
- **Not a replacement for Traffic Manager**: Cross-region LB is L4 (TCP/UDP); Traffic Manager is DNS-based
- **Not a replacement for Front Door**: Front Door is L7 (HTTP/HTTPS) with WAF, caching, and SSL offload
- **Static anycast IP**: Single global IP address that routes to nearest region
- **Automatic failover**: Based on health probe status of regional LBs

## When to Use Cross-Region LB

| Scenario | Use Cross-Region LB? |
|----------|----------------------|
| Global L4 (TCP/UDP) geo-redundancy | ✅ Yes |
| Ultra-low latency L4 traffic | ✅ Yes (anycast routing) |
| Global HTTP/HTTPS with caching | ❌ Use Azure Front Door |
| DNS-based failover (any protocol) | ❌ Use Traffic Manager |
| Regional-only L4 balancing | ❌ Use regional Standard LB |
| NVA chaining | ❌ Use Gateway LB |

## Configuration

### Step 1: Create Regional Load Balancers

Each participating region needs a Standard public LB with backends:

```bash
# Region 1: East US
az network lb create \
  --name lb-eastus \
  --resource-group rg-eastus \
  --sku Standard \
  --frontend-ip-name fe-eastus \
  --backend-pool-name be-eastus \
  --public-ip-address pip-eastus \
  --location eastus

# Region 2: West Europe
az network lb create \
  --name lb-westeurope \
  --resource-group rg-westeurope \
  --sku Standard \
  --frontend-ip-name fe-westeurope \
  --backend-pool-name be-westeurope \
  --public-ip-address pip-westeurope \
  --location westeurope
```

### Step 2: Create Cross-Region Load Balancer

```bash
# Create the global (cross-region) LB
az network lb create \
  --name lb-global \
  --resource-group rg-global \
  --sku Standard \
  --tier Global \
  --frontend-ip-name fe-global \
  --backend-pool-name be-global \
  --public-ip-address pip-global
```

### Step 3: Add Regional LBs as Backends

```bash
# Add regional LBs to the cross-region backend pool
az network lb address-pool address add \
  --lb-name lb-global \
  --resource-group rg-global \
  --pool-name be-global \
  --name addr-eastus \
  --frontend-ip-address "/subscriptions/<sub>/resourceGroups/rg-eastus/providers/Microsoft.Network/loadBalancers/lb-eastus/frontendIPConfigurations/fe-eastus"

az network lb address-pool address add \
  --lb-name lb-global \
  --resource-group rg-global \
  --pool-name be-global \
  --name addr-westeurope \
  --frontend-ip-address "/subscriptions/<sub>/resourceGroups/rg-westeurope/providers/Microsoft.Network/loadBalancers/lb-westeurope/frontendIPConfigurations/fe-westeurope"
```

### Step 4: Add Health Probe and Rule

```bash
# Health probe for cross-region LB
az network lb probe create \
  --lb-name lb-global \
  --resource-group rg-global \
  --name globalProbe \
  --protocol Tcp \
  --port 80

# Load balancing rule
az network lb rule create \
  --lb-name lb-global \
  --resource-group rg-global \
  --name globalRule \
  --protocol Tcp \
  --frontend-port 80 \
  --backend-port 80 \
  --frontend-ip-name fe-global \
  --backend-pool-name be-global \
  --probe-name globalProbe
```

## Failover Behavior

| Scenario | Behavior |
|----------|----------|
| Regional LB healthy | Traffic routed to nearest healthy region (anycast) |
| Regional LB all backends unhealthy | Cross-region LB marks region as down, shifts traffic |
| Regional LB deleted | Backend removed from pool, traffic redistributes |
| Cross-region LB probe failure | Traffic to that region stops within probe-threshold × interval |

### Failover Timing

- Default probe interval: 5 seconds
- Default unhealthy threshold: 2
- **Estimated failover time**: 10-15 seconds

## Limitations

| Limitation | Detail |
|-----------|--------|
| Public only | Cross-region LB supports public frontend only |
| Backend type | Only Standard public LBs (not VMs, VMSS, or internal LBs) |
| Protocols | TCP and UDP only |
| No outbound rules | Outbound managed by regional LBs |
| Region support | Available in most but not all Azure regions |
| Floating IP | Supported |
| HA Ports | Not supported |

## Geo-Redundancy Patterns

### Active-Active

Both regions serve traffic simultaneously. Cross-region LB routes to the nearest region.

### Active-Passive

Deploy backends in both regions but keep passive region's backends scaled down. Health probes keep them in rotation; scale up during failover.

### Multi-Region with Priority

Use cross-region LB for automatic failover but combine with Traffic Manager for DNS-level control and priority routing.

## Source Documentation

- [Cross-region Load Balancer overview](https://learn.microsoft.com/azure/load-balancer/cross-region-overview)
- [Tutorial: Create cross-region LB](https://learn.microsoft.com/azure/load-balancer/tutorial-cross-region-portal)
- [Cross-region LB limitations](https://learn.microsoft.com/azure/load-balancer/cross-region-overview#limitations)
