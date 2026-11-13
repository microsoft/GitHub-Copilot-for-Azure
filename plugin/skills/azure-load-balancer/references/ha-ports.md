# HA Ports Load Balancing

## Overview

HA ports (high-availability ports) is a load balancing rule type on an **internal Standard Load Balancer** that load-balances **all TCP and UDP flows on all ports** in a single rule. This eliminates the need to create individual rules for each port.

## When to Use HA Ports

- **Network Virtual Appliances (NVAs)** — Firewalls, IDS/IPS, WAN optimizers that must inspect all traffic
- **SQL Server AlwaysOn** — Listener requires HA ports + floating IP for availability group failover
- **Any multi-port service** — When a backend needs to receive traffic on many/all ports

## Requirements

| Requirement | Detail |
|------------|--------|
| SKU | Standard (not Basic) |
| Type | Internal only (not public) |
| Protocol | Set to `All` |
| Frontend port | Set to `0` (means all ports) |
| Backend port | Set to `0` (means all ports) |
| Health probe | Required (any protocol) |

## Configuration

### Create Internal LB with HA Ports

```bash
# Step 1: Create internal Standard LB
az network lb create \
  --name myInternalLB \
  --resource-group myRG \
  --sku Standard \
  --frontend-ip-name myFrontEnd \
  --backend-pool-name myBackEnd \
  --vnet-name myVNet \
  --subnet mySubnet

# Step 2: Add health probe
az network lb probe create \
  --lb-name myInternalLB \
  --resource-group myRG \
  --name haProbe \
  --protocol Tcp \
  --port 443 \
  --interval 5 \
  --probe-threshold 2

# Step 3: Create HA ports rule (protocol=All, ports=0)
az network lb rule create \
  --lb-name myInternalLB \
  --resource-group myRG \
  --name haPortsRule \
  --protocol All \
  --frontend-port 0 \
  --backend-port 0 \
  --frontend-ip-name myFrontEnd \
  --backend-pool-name myBackEnd \
  --probe-name haProbe \
  --idle-timeout 4 \
  --enable-tcp-reset true
```

### HA Ports with Floating IP (SQL AlwaysOn)

```bash
az network lb rule create \
  --lb-name myInternalLB \
  --resource-group myRG \
  --name haPortsFloatingIP \
  --protocol All \
  --frontend-port 0 \
  --backend-port 0 \
  --frontend-ip-name myFrontEnd \
  --backend-pool-name myBackEnd \
  --probe-name haProbe \
  --floating-ip true
```

## Architecture Patterns

### NVA Sandwich Pattern

The most common HA ports architecture for NVAs:

```
Internet → Public LB → NVA (inspection) → Internal LB (HA ports) → Backend workloads
```

1. Public Standard LB distributes inbound traffic to NVA pool
2. NVAs inspect traffic and forward to the internal LB's frontend IP
3. Internal LB with HA ports distributes to backend workloads on all ports
4. Return traffic follows the reverse path through the same NVA (session affinity via 5-tuple hash)

### Key NVA Considerations

- **Enable IP forwarding** on NVA NICs: `az network nic update --name <nic> -g <rg> --ip-forwarding true`
- **UDR required** — Route table on backend subnet with next hop = internal LB frontend IP
- **Asymmetric routing** — Use HA ports + session persistence to ensure return traffic hits same NVA
- **Multiple frontend IPs** — HA ports rule applies per-frontend. Multiple frontends need multiple HA port rules.

### SQL AlwaysOn Pattern

```
Application → Internal LB (HA ports + floating IP) → SQL AG Listener → Primary replica
```

- Floating IP must be enabled so the backend sees the LB frontend IP as destination
- SQL AG listener IP matches the LB frontend IP
- Health probe on port 59999 (custom probe port for SQL AG health)

## Limitations

| Limitation | Detail |
|-----------|--------|
| Internal only | HA ports not available on public LB |
| Single frontend per rule | Each HA ports rule binds to one frontend IP |
| Cannot combine with port-specific rules | HA ports rule on a frontend conflicts with per-port rules on same frontend |
| Gateway LB alternative | For transparent chaining, consider Gateway LB (always HA ports by design) |

## Troubleshooting

| Issue | Check |
|-------|-------|
| NVA not receiving all traffic | Verify UDR next-hop = LB frontend IP, IP forwarding enabled |
| Asymmetric routing | Ensure both directions traverse same NVA (check session persistence) |
| SQL AG failover not working | Verify floating IP enabled, probe port matches SQL health check port |
| Only TCP works, UDP drops | Verify protocol is set to `All` (not TCP) in the HA ports rule |

## Source Documentation

- [HA ports overview](https://learn.microsoft.com/azure/load-balancer/load-balancer-ha-ports-overview)
- [NVA high availability](https://learn.microsoft.com/azure/architecture/reference-architectures/dmz/nva-ha)
- [Configure HA ports](https://learn.microsoft.com/azure/load-balancer/load-balancer-ha-ports-overview#configure-ha-ports)
