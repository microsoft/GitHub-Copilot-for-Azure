---
name: azure-load-balancer
description: "Create, configure, and troubleshoot Azure Load Balancer for Layer 4 (TCP/UDP) traffic distribution across virtual machines and instances. Covers Standard SKU (public and internal), Gateway Load Balancer for NVA chaining, and Cross-region Load Balancer for geo-redundancy. WHEN: load balancer, health probe, backend pool, HA ports, inbound NAT rule, outbound rule, cross-region load balancer, gateway load balancer, L4 load balancing, TCP/UDP balancing, SNAT, floating IP, DSR. DO NOT USE FOR: L7/HTTP load balancing (use azure-application-gateway), global HTTP routing or CDN (use azure-front-door)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Load Balancer

## When to Use This Skill

- User asks about creating or configuring an Azure Load Balancer (Standard, Gateway, or Cross-region)
- User needs to distribute TCP or UDP traffic across backend VMs or scale sets
- User wants to configure health probes (TCP, HTTP, HTTPS) for backend monitoring
- User needs to set up HA ports for NVA (network virtual appliance) deployments
- User asks about inbound NAT rules for port forwarding to specific VMs
- User needs to configure outbound rules or troubleshoot SNAT port exhaustion
- User is migrating from Basic to Standard Load Balancer SKU
- User wants cross-region (global) load balancing for geo-redundancy
- User asks about Gateway Load Balancer for transparent NVA insertion
- User needs to troubleshoot unhealthy backend pool members

## Rules

1. **Always recommend Standard SKU** — Basic Load Balancer is deprecated (retirement September 30, 2025). Guide users to migrate using `az network lb list` to identify Basic LBs.
2. **Backend pool membership** — Standard LB requires all backends in the same virtual network. Mix of VMs and VMSS is supported via IP-based backend pools.
3. **Health probes are mandatory** — Every load balancing rule must have a health probe. Without one, all backends are considered healthy and traffic goes to unreachable instances.
4. **Outbound connectivity** — Standard LB does NOT provide default outbound access. Users MUST configure one of: outbound rules, NAT Gateway, or instance-level public IPs.
5. **HA Ports require Standard Internal LB** — HA ports rules are only available on internal Standard Load Balancers. They load-balance ALL protocols and ports in a single rule.
6. **Cross-region LB backends are regional LBs** — Cross-region LB uses regional Standard public LBs as its backend pool, not VMs directly.
7. **Gateway LB is chained** — Gateway LB is referenced from a frontend IP config of another LB or VM NIC. It transparently intercepts traffic for NVA processing.
8. **Floating IP (Direct Server Return)** — Required for SQL AlwaysOn and other scenarios needing the frontend IP on the backend. Enable on the load balancing rule.
9. **Suggest NAT Gateway for outbound** — When users need scalable outbound connectivity, recommend NAT Gateway over LB outbound rules for better performance and simpler management.
10. **Cross-reference other LB services** — If the user needs HTTP/HTTPS routing, WAF, or path-based routing, redirect to azure-application-gateway. For global HTTP edge routing or CDN, redirect to azure-front-door.

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__network` | `lb_list` | List all load balancers in a subscription/resource group |
| `azure__network` | `lb_get` | Get detailed configuration of a specific load balancer |

## CLI Fallback

When MCP tools are unavailable, use these Azure CLI commands:

```bash
# List load balancers
az network lb list --resource-group <rg> --output table

# Show load balancer details
az network lb show --name <lb-name> --resource-group <rg>

# Create a Standard public load balancer
az network lb create \
  --name <lb-name> \
  --resource-group <rg> \
  --sku Standard \
  --frontend-ip-name myFrontEnd \
  --backend-pool-name myBackEndPool \
  --public-ip-address <pip-name>

# Create an internal load balancer
az network lb create \
  --name <lb-name> \
  --resource-group <rg> \
  --sku Standard \
  --frontend-ip-name myFrontEnd \
  --backend-pool-name myBackEndPool \
  --vnet-name <vnet> \
  --subnet <subnet>

# Add a health probe
az network lb probe create \
  --lb-name <lb-name> \
  --resource-group <rg> \
  --name myHealthProbe \
  --protocol Tcp \
  --port 80 \
  --interval 5 \
  --probe-threshold 2

# Add a load balancing rule
az network lb rule create \
  --lb-name <lb-name> \
  --resource-group <rg> \
  --name myRule \
  --protocol Tcp \
  --frontend-port 80 \
  --backend-port 80 \
  --frontend-ip-name myFrontEnd \
  --backend-pool-name myBackEndPool \
  --probe-name myHealthProbe

# Add an inbound NAT rule
az network lb inbound-nat-rule create \
  --lb-name <lb-name> \
  --resource-group <rg> \
  --name myNATRule \
  --protocol Tcp \
  --frontend-port 3389 \
  --backend-port 3389 \
  --frontend-ip-name myFrontEnd

# Add an outbound rule
az network lb outbound-rule create \
  --lb-name <lb-name> \
  --resource-group <rg> \
  --name myOutboundRule \
  --protocol All \
  --frontend-ip-configs myFrontEnd \
  --address-pool myBackEndPool \
  --allocated-outbound-ports 10000 \
  --idle-timeout 4

# Configure HA ports (internal LB)
az network lb rule create \
  --lb-name <lb-name> \
  --resource-group <rg> \
  --name haPortsRule \
  --protocol All \
  --frontend-port 0 \
  --backend-port 0 \
  --frontend-ip-name myFrontEnd \
  --backend-pool-name myBackEndPool \
  --probe-name myHealthProbe

# Find Basic LBs needing migration
az network lb list --query "[?sku.name=='Basic']" --output table
```

## Key Concepts

### Load Balancer SKU Comparison

| Feature | Standard | Gateway | Cross-region |
|---------|----------|---------|-------------|
| Layer | L4 (TCP/UDP) | L4 (transparent) | L4 (TCP/UDP) |
| Backend type | VMs, VMSS in one VNet | NVAs | Regional Standard LBs |
| Health probes | TCP, HTTP, HTTPS | TCP, HTTP, HTTPS | TCP, HTTP, HTTPS |
| Availability Zones | Zone-redundant / zonal | Zone-redundant | Inherits from regional |
| Public + Internal | Both | Internal only | Public only |
| HA Ports | Internal only | Yes (always) | No |
| Floating IP | Yes | N/A | Yes |
| Max backends | 5,000 (IP-based) | 100 | Regional LBs as backends |
| SLA | 99.99% | 99.99% | 99.99% |

### Distribution Modes

| Mode | Hash | Use Case |
|------|------|----------|
| Default (5-tuple) | Source IP, source port, dest IP, dest port, protocol | General workloads |
| Source IP affinity (2-tuple) | Source IP, dest IP | Stateful apps without cookies |
| Source IP + protocol (3-tuple) | Source IP, dest IP, protocol | Multiple protocols same session |

## References

- [SKU comparison and migration guide](references/lb-skus.md)
- [Health probe configuration and troubleshooting](references/health-probes.md)
- [HA ports configuration](references/ha-ports.md)
- [Cross-region load balancing](references/cross-region.md)
- [Outbound rules and SNAT](references/outbound-rules.md)
