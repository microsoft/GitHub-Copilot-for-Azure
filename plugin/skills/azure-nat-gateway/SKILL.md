---
name: azure-nat-gateway
description: "Deploy and manage Azure NAT Gateway for scalable, reliable outbound internet connectivity and SNAT port management. WHEN: NAT gateway, outbound internet, SNAT exhaustion, SNAT ports, outbound connectivity, default outbound. DO NOT USE FOR: inbound load balancing (use azure-load-balancer), private connectivity to PaaS (use azure-private-link), DNS-based traffic routing (use azure-traffic-manager)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure NAT Gateway Skill

## When to Use This Skill

- User needs reliable outbound internet connectivity from Azure VMs or services
- User is experiencing SNAT port exhaustion with Load Balancer or default outbound
- User wants a static outbound public IP for firewall allowlisting
- User asks about default outbound access retirement
- User needs to scale outbound connections beyond what Load Balancer SNAT provides
- User wants to troubleshoot outbound connectivity failures
- User asks about NAT Gateway metrics or monitoring

## Rules

1. NAT Gateway is the recommended solution for outbound internet access — default outbound access is being retired.
2. NAT Gateway provides 64,512 SNAT ports per public IP address — up to 16 public IPs = 1,032,192 ports.
3. NAT Gateway supersedes all other outbound configurations on a subnet (LB SNAT rules, VM public IPs for outbound).
4. Associate NAT Gateway at the subnet level — different subnets can use different NAT Gateways.
5. NAT Gateway does NOT support inbound-initiated connections — it is outbound-only.
6. Idle timeout is configurable from 4 to 120 minutes (default: 4 minutes).
7. NAT Gateway requires Standard SKU public IPs — Basic SKU is not supported.
8. Always recommend NAT Gateway over Load Balancer outbound rules for high-connection workloads.
9. For multiple public IPs, NAT Gateway distributes flows across them automatically — you cannot pin a specific IP.
10. NAT Gateway is zone-resilient — it survives single availability zone failures.

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__network` | `nat_gateway_list` | List all NAT Gateways in a subscription or resource group |
| `azure__network` | `nat_gateway_get` | Get details of a specific NAT Gateway including associated subnets and IPs |

## CLI Fallback

```bash
# Create a public IP for NAT Gateway
az network public-ip create -g MyRG -n NATPublicIP --sku Standard --allocation-method Static

# Create NAT Gateway
az network nat gateway create -g MyRG -n MyNATGateway --public-ip-addresses NATPublicIP \
  --idle-timeout 10

# Associate NAT Gateway with a subnet
az network vnet subnet update -g MyRG --vnet-name MyVNet -n AppSubnet \
  --nat-gateway MyNATGateway

# Add additional public IP to NAT Gateway
az network public-ip create -g MyRG -n NATPublicIP2 --sku Standard --allocation-method Static
az network nat gateway update -g MyRG -n MyNATGateway \
  --public-ip-addresses NATPublicIP NATPublicIP2

# Use public IP prefix instead
az network public-ip prefix create -g MyRG -n NATPrefix --length 28
az network nat gateway update -g MyRG -n MyNATGateway --public-ip-prefixes NATPrefix

# Show NAT Gateway details
az network nat gateway show -g MyRG -n MyNATGateway
az network nat gateway list -g MyRG -o table

# Remove NAT Gateway from subnet
az network vnet subnet update -g MyRG --vnet-name MyVNet -n AppSubnet --nat-gateway ""

# Check NAT Gateway metrics (via Azure Monitor)
az monitor metrics list --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --metric SNATConnectionCount --interval PT1H
```

## Key Concepts

### NAT Gateway vs Other Outbound Methods

| Feature | NAT Gateway | LB Outbound Rules | Default Outbound | VM Public IP |
|---------|-------------|-------------------|------------------|-------------|
| SNAT ports per IP | 64,512 | Configurable (max 1,024/instance) | Limited | All ports |
| Scale | Up to 16 IPs | Depends on backend pool | Not scalable | Per-VM |
| Reliability | Zone-resilient | Zone-dependent | No SLA | Zone-dependent |
| Idle timeout | 4-120 min | 4-120 min | 4 min | 4 min |
| Static outbound IP | Yes | Yes | No (random) | Yes |
| Recommended | ✅ Yes | For inbound+outbound | ⚠️ Retiring | Single VM only |

### Port Calculation

| Public IPs | Total SNAT Ports | Max to Single Destination |
|------------|------------------|--------------------------|
| 1 | 64,512 | 64,512 |
| 2 | 129,024 | 64,512 per IP |
| 4 | 258,048 | 64,512 per IP |
| 8 | 516,096 | 64,512 per IP |
| 16 (max) | 1,032,192 | 64,512 per IP |

### SNAT Timer Behavior

| Scenario | Timer | Notes |
|----------|-------|-------|
| TCP idle timeout | 4-120 min (configurable) | Reset on data transfer |
| TCP FIN | 120 seconds | After FIN sent |
| TCP RST | 10 seconds | Immediate port reclaim after RST |
| UDP idle timeout | 4 minutes | Not configurable |

## References

- [SNAT Fundamentals](references/snat-fundamentals.md)
- [NAT Gateway Metrics](references/nat-gateway-metrics.md)
- [Troubleshoot SNAT Exhaustion](references/troubleshoot-snat.md)
