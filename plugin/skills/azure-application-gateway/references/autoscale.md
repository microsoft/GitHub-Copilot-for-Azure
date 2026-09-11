# Application Gateway v2 Autoscaling

## Overview

Application Gateway v2 supports autoscaling based on traffic load patterns. The gateway automatically adjusts the number of instances up or down based on traffic demand.

## Scaling Modes

| Mode | Config | Behavior |
|------|--------|----------|
| Autoscaling | `minCapacity` + `maxCapacity` | Scales between min and max based on load |
| Fixed | `capacity` (no autoscale) | Static number of instances (manual scaling) |

## Autoscale Configuration

### Enable Autoscaling

```bash
# Set autoscale with min 2, max 10 instances
az network application-gateway update \
  --name myAppGw -g myRG \
  --set autoscaleConfiguration.minCapacity=2 \
  --set autoscaleConfiguration.maxCapacity=10 \
  --set sku.capacity=null
```

**Important**: Setting `sku.capacity=null` switches from fixed to autoscale mode.

### Switch to Fixed Capacity

```bash
az network application-gateway update \
  --name myAppGw -g myRG \
  --capacity 4 \
  --remove autoscaleConfiguration
```

### During Initial Deployment

```bash
az network application-gateway create \
  --name myAppGw -g myRG \
  --sku Standard_v2 \
  --min-capacity 2 \
  --max-capacity 10 \
  --vnet-name myVNet \
  --subnet AppGwSubnet \
  --public-ip-address appgw-pip
```

## Capacity Planning

### Instance Capacity

Each Application Gateway instance can handle approximately:

| Metric | Approximate per Instance |
|--------|-------------------------|
| Throughput | ~500 Mbps |
| Connections | ~2,500 concurrent |
| Requests/sec | Varies by request size |
| SSL TPS (RSA 2048) | ~2,500 new connections/sec |
| SSL TPS (ECC 256) | ~8,000 new connections/sec |

### Sizing Guidelines

| Workload | Min Capacity | Max Capacity |
|----------|-------------|-------------|
| Dev/Test | 0-1 | 2-3 |
| Small production | 2 | 5-10 |
| Medium production | 2-3 | 10-20 |
| Large / high-traffic | 5-10 | 20-125 |

**Important considerations:**
- `minCapacity` = 0 means the gateway can scale to zero (saves cost but has cold-start latency ~6-8 minutes)
- `minCapacity` ≥ 2 recommended for production (always-ready, zone-redundant)
- Maximum capacity is **125 instances** per Application Gateway
- Scale-up time is approximately 6-8 minutes per scaling event

### Minimum Capacity Recommendations

| Scenario | Min Capacity | Reason |
|----------|-------------|--------|
| Production (always ready) | 2 | Avoids cold start; zone-redundant |
| Dev/test (cost saving) | 0 | Scales to zero when idle |
| High-traffic baseline | Match typical minimum load | Prevents scaling delays during normal operation |
| Spiky traffic | Match normal load | Pre-warms; autoscale handles spikes |

## Cost Implications

Application Gateway v2 billing:

| Component | Charge |
|-----------|--------|
| Fixed cost | Per gateway per hour (even with 0 instances, there's a base cost) |
| Capacity units | Per capacity unit per hour |

Each **capacity unit** consists of:
- 2,500 persistent connections
- 2.22 Mbps throughput
- 1 compute unit (request processing)

You pay for whichever is highest. More instances = more capacity units = higher cost.

### Cost Optimization Tips

1. **Right-size minCapacity** — Don't over-provision minimum. Use metrics to find baseline.
2. **Set maxCapacity** — Always set a maximum to prevent unexpected costs from traffic spikes or DDoS.
3. **Monitor Capacity Units** — Azure Monitor metric `CapacityUnits` shows actual usage vs. provisioned.
4. **Consider WAF cost** — WAF_v2 has higher per-instance cost than Standard_v2.
5. **Dev/test scale to zero** — Use `minCapacity=0` for non-production.

## Monitoring Autoscale

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `CurrentCapacity` | Current number of instances | Near maxCapacity |
| `CapacityUnits` | Capacity units consumed | > 75% of provisioned |
| `ComputeUnits` | Compute utilization | > 75% per instance |
| `EstimatedBilledCapacityUnits` | Estimated billing units | Budget monitoring |

```bash
# Check current capacity
az monitor metrics list \
  --resource <appgw-resource-id> \
  --metric "CurrentCapacity" \
  --aggregation Average \
  --interval PT5M

# Check capacity unit utilization
az monitor metrics list \
  --resource <appgw-resource-id> \
  --metric "CapacityUnits" \
  --aggregation Average \
  --interval PT5M
```

### Autoscale Behavior

- **Scale up trigger**: When current capacity units exceed 75% threshold
- **Scale down trigger**: When utilization drops below threshold for a sustained period
- **Scale up time**: ~6-8 minutes per instance
- **Scale down time**: Gradual (conservative to avoid flapping)
- **Cooldown**: Built-in to prevent rapid scale in/out cycles

## Availability Zones

When `minCapacity` ≥ 2, Application Gateway v2 automatically distributes instances across configured availability zones.

```bash
# Create zone-redundant App Gateway
az network application-gateway create \
  --name myAppGw -g myRG \
  --sku Standard_v2 \
  --min-capacity 2 \
  --max-capacity 10 \
  --zones 1 2 3 \
  --vnet-name myVNet \
  --subnet AppGwSubnet \
  --public-ip-address appgw-pip
```

## Source Documentation

- [Application Gateway autoscaling](https://learn.microsoft.com/azure/application-gateway/application-gateway-autoscaling-zone-redundant)
- [Application Gateway pricing](https://azure.microsoft.com/pricing/details/application-gateway/)
- [Application Gateway metrics](https://learn.microsoft.com/azure/application-gateway/application-gateway-metrics)
