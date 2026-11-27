# NVA-in-Hub Deployment

## Overview

Network Virtual Appliances (NVAs) in the vWAN hub allow you to deploy supported third-party networking solutions directly inside the virtual hub. This enables SD-WAN optimization, custom firewalling, and traffic inspection without deploying NVAs in spoke VNets with complex UDR management.

## Supported Partners

NVA-in-hub requires validation from both Microsoft and the NVA vendor. Only the following partners are supported:

| Partner | NVA Type | Primary Use Case |
|---------|----------|-----------------|
| **Barracuda Networks** | CloudGen WAN | SD-WAN, firewall |
| **Cisco** | Catalyst SD-WAN (Viptela) | SD-WAN |
| **Fortinet** | FortiGate Next-Gen Firewall | Firewall, SD-WAN |
| **VMware** | SD-WAN (VeloCloud) | SD-WAN |
| **Versa Networks** | SD-WAN | SD-WAN |
| **Check Point** | CloudGuard Network Security | Firewall |
| **Palo Alto Networks** | Cloud NGFW | Firewall (SaaS model) |

**You cannot deploy arbitrary NVA images** (custom VMs, marketplace VMs) directly in the hub. Only validated partner solutions are supported through the managed application framework.

## Architecture

```
                    ┌────────────────────────────────┐
                    │        Virtual Hub             │
                    │                                │
 Branch ─── VPN GW ─┤                                ├── Spoke VNet A
                    │       ┌──────────┐             │
 Branch ─── SD-WAN ─┤──────►│  NVA     │─────────────├── Spoke VNet B
                    │       │ (Partner)│             │
 On-Prem ── ER GW ──┤──────►│          │─────────────├── Spoke VNet C
                    │       └──────────┘             │
                    └────────────────────────────────┘
```

NVAs sit in the data path within the hub, intercepting traffic based on routing configuration.

## Deployment Process

### Step 1: Ensure Standard vWAN and Hub Exist

```bash
# Verify vWAN type is Standard
az network vwan show --name <vwan-name> --resource-group <rg> --query type

# Verify hub exists
az network vhub show --name <hub-name> --resource-group <rg>
```

### Step 2: Deploy NVA via Azure Marketplace

NVA-in-hub deployment is typically done through:
1. **Azure Marketplace** — search for the partner's vWAN NVA offering
2. **Partner portal** — some partners provide direct deployment from their management console
3. **ARM/Bicep templates** — for infrastructure-as-code deployments

The deployment creates a **managed application** in your subscription, which provisions the NVA instances inside the hub.

### Step 3: Configure NVA Scale Units

NVA-in-hub supports scaling through infrastructure units (similar to gateway scale units):

| Infrastructure Units | Approximate Throughput |
|---------------------|----------------------|
| 2 | 500 Mbps - 1 Gbps |
| 4 | 1 - 2 Gbps |
| 10 | 2 - 5 Gbps |
| 20 | 5 - 10 Gbps |

Exact throughput depends on the NVA partner and configuration. Refer to partner documentation for sizing.

### Step 4: Configure NVA Through Partner Management

After deployment, NVA configuration (firewall rules, SD-WAN policies, routing) is managed through the **partner's management interface**, not through Azure:

- **Barracuda:** CloudGen WAN portal
- **Cisco:** vManage
- **Fortinet:** FortiManager / FortiGate management
- **VMware:** VMware SD-WAN Orchestrator
- **Versa:** Versa Director

## Routing with NVA-in-Hub

### Advertising Routes from NVA

NVAs in the hub can advertise routes via BGP to the hub's routing infrastructure:

```
NVA → BGP → Hub Route Table → All Connections (VNets, VPN, ER)
```

The NVA establishes a BGP session with the hub's route service using:
- Hub's BGP peer IPs (provided during NVA deployment)
- NVA's own BGP IP (configured in the NVA)

### Directing Traffic Through NVA

To force traffic through the NVA, you have two options:

**Option A: Routing Intent (Recommended)**
If the NVA supports being the next-hop for routing intent, configure routing intent with the NVA as the next hop:

```bash
az network vhub routing-intent create \
  --name <intent-name> \
  --resource-group <rg> \
  --vhub <hub-name> \
  --routing-policies "[{name:PrivateTraffic,destinations:[PrivateTraffic],nextHop:<nva-resource-id>}]"
```

**Option B: Static Routes in Hub Route Table**
For more granular control, add static routes pointing to the NVA:

```bash
az network vhub route-table route add \
  --resource-group <rg> \
  --vhub-name <hub-name> \
  --route-table-name defaultRouteTable \
  --destinations 10.0.0.0/8 \
  --destination-type CIDR \
  --next-hop <nva-connection-resource-id> \
  --next-hop-type ResourceId
```

### BGP Peering with NVA

The NVA peers with the hub's route service over BGP:

```
NVA BGP ASN: (configured per partner, e.g., 65222)
Hub BGP ASN: 65515
BGP Peer IPs: provided by the hub during NVA provisioning
```

Routes advertised by the NVA are propagated to all hub connections (VNets, branches) based on route table associations.

## NVA-in-Hub vs NVA-in-Spoke

| Consideration | NVA-in-Hub | NVA-in-Spoke |
|-------------|-----------|-------------|
| UDR management | Minimal (hub routing handles it) | Complex (UDRs on every spoke subnet) |
| Scaling | Managed scale units | Manual VM scaling |
| Vendor support | Only validated partners | Any NVA from marketplace |
| Management | Partner management console | Direct VM access |
| Availability | Hub-managed redundancy | Self-managed (VMSS, LB) |
| Cost | Partner pricing + hub costs | VM pricing + LB + management |
| Flexibility | Limited to partner capabilities | Full VM customization |

**Choose NVA-in-hub** when:
- Using a validated SD-WAN partner for branch connectivity
- Wanting simplified routing without complex UDR management
- Partner provides the specific NVA features needed

**Choose NVA-in-spoke** when:
- Using a vendor not validated for NVA-in-hub
- Needing full control over NVA configuration and networking
- Custom NVA or marketplace appliance required

## Coexistence: NVA + Azure Firewall

You can deploy both an NVA and Azure Firewall in the same hub:

- **NVA** handles SD-WAN optimization and branch connectivity
- **Azure Firewall** handles security inspection (with routing intent)

Traffic flow:
```
Branch → NVA (SD-WAN) → Azure Firewall (security) → Spoke VNet
```

Configure routing intent with Azure Firewall as the security next-hop, while the NVA handles the branch connectivity overlay.

## Monitoring NVA-in-Hub

### Azure Monitor Metrics

NVAs expose metrics through Azure Monitor:
- Throughput (ingress/egress)
- CPU utilization
- Memory utilization
- Connection count

### Partner Monitoring

Detailed NVA monitoring (rule hits, SD-WAN performance, session logs) is managed through the partner's monitoring tools, not Azure Monitor.

### Health Probes

The hub monitors NVA health automatically. If an NVA instance becomes unhealthy:
- Traffic is redirected to healthy instances
- The platform attempts to recover the unhealthy instance
- Alerts can be configured in Azure Monitor

## Troubleshooting

### NVA Deployment Fails

1. **Check vWAN type** — must be Standard
2. **Check hub address space** — ensure /23 or larger for NVA deployment room
3. **Check subscription quota** — NVA deployment creates managed resources that consume quota
4. **Check partner prerequisites** — some partners require pre-registration or licensing

### Traffic Not Flowing Through NVA

1. **Check routing** — verify hub route table shows NVA as next hop for target prefixes
2. **Check BGP peering** — NVA must have active BGP sessions with the hub
3. **Check NVA health** — verify NVA instances are healthy in the managed application
4. **Check NVA rules** — verify the NVA's firewall/routing rules allow the traffic
5. **Check routing intent** — if using routing intent, verify NVA is the configured next hop

### Performance Issues

1. **Scale up** — increase infrastructure units for more throughput
2. **Check NVA CPU/memory** — partner monitoring tools show NVA resource utilization
3. **Check MTU** — encapsulation overhead may cause fragmentation; verify MTU settings
4. **Check partner logs** — SD-WAN optimization or deep inspection may add latency

## Additional References

- [NVA in virtual hub](https://learn.microsoft.com/azure/virtual-wan/about-nva-hub)
- [Deploy NVA in vWAN hub](https://learn.microsoft.com/azure/virtual-wan/how-to-nva-hub)
- [BGP peering with NVA](https://learn.microsoft.com/azure/virtual-wan/scenario-bgp-peering-hub)
- [Supported NVA partners](https://learn.microsoft.com/azure/virtual-wan/about-nva-hub#partners)
