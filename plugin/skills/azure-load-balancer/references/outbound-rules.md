# Outbound Rules and SNAT

## The Outbound Connectivity Problem

Standard Load Balancer does **NOT** provide default outbound internet access for backend pool members. This is a security-by-design change from Basic LB. You must explicitly configure one of:

1. **NAT Gateway** (recommended) — simplest, most scalable
2. **Outbound rules** on the Standard LB
3. **Instance-level public IPs** on each VM
4. **Azure Firewall / NVA** with UDR

## Understanding SNAT (Source NAT)

When a backend VM initiates an outbound connection, its private IP must be translated to a public IP. This is SNAT. Each public IP provides **64,512 SNAT ports** (ephemeral ports 1024-65535).

### SNAT Port Allocation

| Method | Ports per VM | Calculation |
|--------|-------------|-------------|
| Outbound rules (manual) | User-defined | Total ports ÷ backend count |
| Outbound rules (auto) | Automatic | Tiered based on pool size |
| NAT Gateway | Dynamic | Up to 64,512 per IP, shared dynamically |
| Instance public IP | 64,512 | Dedicated to that VM |

### Automatic Port Allocation Tiers (Outbound Rules)

| Backend Pool Size | Ports per Instance |
|-------------------|--------------------|
| 1-50 | 1,024 |
| 51-100 | 512 |
| 101-200 | 256 |
| 201-400 | 128 |
| 401-800 | 64 |
| 801-1,000 | 32 |

## Configuring Outbound Rules

### Basic Outbound Rule

```bash
# Requires at least one frontend IP configuration
az network lb outbound-rule create \
  --lb-name myLB \
  --resource-group myRG \
  --name myOutboundRule \
  --protocol All \
  --frontend-ip-configs myFrontEnd \
  --address-pool myBackEndPool \
  --allocated-outbound-ports 10000 \
  --idle-timeout 4 \
  --enable-tcp-reset true
```

### Outbound Rule with Multiple Public IPs

For higher SNAT port capacity, add more frontend public IPs:

```bash
# Create additional public IPs
az network public-ip create --name pip-outbound-2 -g myRG --sku Standard --allocation-method Static
az network public-ip create --name pip-outbound-3 -g myRG --sku Standard --allocation-method Static

# Add to LB frontend
az network lb frontend-ip create --lb-name myLB -g myRG --name feFrontEnd2 --public-ip-address pip-outbound-2
az network lb frontend-ip create --lb-name myLB -g myRG --name feFrontEnd3 --public-ip-address pip-outbound-3

# Outbound rule with multiple frontends
az network lb outbound-rule create \
  --lb-name myLB -g myRG \
  --name outboundMultiIP \
  --protocol All \
  --frontend-ip-configs myFrontEnd feFrontEnd2 feFrontEnd3 \
  --address-pool myBackEndPool \
  --allocated-outbound-ports 10000
```

**Total SNAT ports**: 3 IPs × 64,512 = 193,536 ports to distribute across backends.

### Outbound Rule with IP Prefix

For large-scale deployments, use a public IP prefix:

```bash
# Create /28 prefix (16 IPs = 16 × 64,512 = 1,032,192 ports)
az network public-ip prefix create \
  --name myOutboundPrefix \
  -g myRG \
  --length 28

# Use prefix on LB frontend
az network lb frontend-ip create \
  --lb-name myLB -g myRG \
  --name fePrefixFrontEnd \
  --public-ip-prefix myOutboundPrefix
```

## NAT Gateway vs Outbound Rules

| Feature | NAT Gateway | LB Outbound Rules |
|---------|-------------|-------------------|
| SNAT ports | Dynamic (up to 64,512/IP) | Static allocation |
| Port exhaustion risk | Low (dynamic) | Higher (fixed allocation) |
| Max public IPs | 16 | Depends on LB config |
| Idle timeout | 4-120 min | 4-100 min |
| Availability zones | Zone-redundant | Inherits from LB |
| Complexity | Simple (attach to subnet) | Moderate (rule config) |
| Works without LB | Yes | No (requires LB) |
| Cost | Separate resource cost | Included with LB |

**Recommendation**: Use NAT Gateway for outbound connectivity. It's simpler, avoids SNAT port exhaustion, and works independently of the load balancer.

```bash
# Create NAT Gateway (preferred approach)
az network nat gateway create \
  --name myNATGateway \
  -g myRG \
  --public-ip-addresses pip-nat \
  --idle-timeout 10

# Associate with subnet
az network vnet subnet update \
  --vnet-name myVNet \
  --name mySubnet \
  -g myRG \
  --nat-gateway myNATGateway
```

## Diagnosing SNAT Port Exhaustion

### Symptoms

- Outbound connections failing intermittently
- `SNAT port exhaustion` in Azure Monitor metrics
- Application timeout errors on outbound calls

### Check SNAT Metrics

```bash
# Used SNAT ports
az monitor metrics list \
  --resource <lb-resource-id> \
  --metric "SnatConnectionCount" \
  --aggregation Total \
  --interval PT1M \
  --filter "ConnectionState eq 'Failed'"
```

In Azure Portal: Load Balancer → Metrics → "SNAT Connection Count" → Split by ConnectionState.

### Mitigation Strategies

1. **Add more public IPs** to increase total SNAT port pool
2. **Use NAT Gateway** instead (dynamic port allocation avoids static limits)
3. **Reduce idle timeout** to reclaim ports faster (default 4 min)
4. **Connection pooling** in your application (reuse connections instead of new ones)
5. **Enable TCP reset on idle** to clean up half-open connections

### SNAT Port Calculator

```
Required ports = (concurrent_outbound_connections_per_vm) × (number_of_backend_vms)
Public IPs needed = Required ports ÷ 64,512  (round up)
```

Example: 100 VMs × 2,000 connections = 200,000 ports → need 4 public IPs minimum.

## Disabling Default Outbound Access

As of September 2025, new VMs in Azure have default outbound access disabled. Existing deployments may still have it. To explicitly disable:

```bash
# Set "disableOutboundSnat" on the LB rule (prevents rule-based SNAT)
az network lb rule update \
  --lb-name myLB -g myRG \
  --name myRule \
  --disable-outbound-snat true
```

## Source Documentation

- [Outbound connections in Azure](https://learn.microsoft.com/azure/load-balancer/load-balancer-outbound-connections)
- [Outbound rules](https://learn.microsoft.com/azure/load-balancer/outbound-rules)
- [SNAT port exhaustion troubleshooting](https://learn.microsoft.com/azure/load-balancer/troubleshoot-outbound-connection)
- [Default outbound access retirement](https://learn.microsoft.com/azure/virtual-network/ip-services/default-outbound-access)
