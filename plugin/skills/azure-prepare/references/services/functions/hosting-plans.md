# Azure Functions Hosting Plans

## Plan Comparison Matrix

| Feature | Consumption (Y1) | Flex Consumption (FC1) | Premium (EP1-EP3) | Dedicated (B1-P3v3) | Container Apps |
|---------|:-:|:-:|:-:|:-:|:-:|
| **Max scale (instances)** | 200 | 1000 | 100 | 10-30 | 300 |
| **Per-function scaling** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Always-ready instances** | ❌ | ✅ | ✅ | ✅ (always on) | ✅ (minReplicas) |
| **Scale to zero** | ✅ | ✅ | ❌ (≥1) | ❌ | ✅ |
| **VNet integration** | ❌ | ✅ | ✅ | ✅ (Standard+) | ✅ |
| **Private endpoints** | ❌ | ✅ | ✅ | ✅ (Standard+) | ✅ |
| **Deployment slots** | Win: 1 / Linux: ❌ | ❌ | ✅ 20 | ✅ 5-20 | Via revisions |
| **Max execution (min)** | 10 | 30 | Unlimited | Unlimited | Unlimited |
| **Min memory (GB)** | 1.5 | 2-4 | 3.5-14 | 1.75-14 | 0.5-4 |
| **OS support** | Windows + Linux | Linux only | Windows + Linux | Windows + Linux | Linux only |
| **Idle timeout** | 5 min | Configurable | None | None | Configurable |

## Cost Models

| Plan | Pricing Model | Approximate Monthly Cost |
|------|--------------|-------------------------|
| Consumption | Per-execution + GB-s; 1M free executions/mo | $0 – $20 (light workloads) |
| Flex Consumption | Per-execution + GB-s; always-ready base cost | $5 – $50 |
| Premium (EP1) | Per-instance per-hour; ≥1 always running | ~$155+/mo (1 instance) |
| Dedicated (B1) | Per-instance per-hour; always running | ~$55+/mo (1 instance) |
| Container Apps | Per-vCPU-s + per-GiB-s; scale-to-zero | $0 – varies |

> 💡 **Tip:** Consumption and Flex Consumption are the only plans that truly scale to zero and charge nothing at idle.

## Decision Criteria

```
Need per-function scaling or fast cold starts on Linux?
├─ Yes → Flex Consumption
└─ No
   Need VNet integration?
   ├─ No → Consumption (lowest cost)
   └─ Yes
      Execution time > 10 min?
      ├─ Yes → Premium or Dedicated
      └─ No
         Budget-sensitive with bursty traffic?
         ├─ Yes → Flex Consumption
         └─ No → Premium (predictable latency)
```

## Plan-Specific Considerations

### Consumption (Y1)

- Best for: Low-traffic, event-driven workloads with tolerance for cold starts
- Limitation: 10-min max execution, no VNet, Linux cold starts can be 5-10s

### Flex Consumption (FC1)

- Best for: Linux workloads needing fast scaling, VNet, and per-function concurrency
- Limitation: Linux only, no deployment slots, some triggers require EventGrid source
- Active investment from Microsoft — newest features land here first

### Premium (EP1–EP3)

- Best for: Latency-sensitive workloads, long-running functions, enterprise VNet requirements
- Includes pre-warmed instances to eliminate cold starts
- Higher cost due to always-on minimum instance

### Dedicated (App Service Plan)

- Best for: Already running App Service apps; consolidate Functions onto existing plans
- Full App Service features: slots, hybrid connections, custom domains
- No auto-scale to zero — you pay for the plan 24/7

### Container Apps Hosting

- Best for: Microservices architectures, multi-container deployments, Dapr integration
- Functions runs as a container with KEDA-based scaling
- Requires containerized function app (Dockerfile)

## SKU Quick Reference

| Plan | SKU Name | vCPU | Memory |
|------|----------|------|--------|
| Consumption | Y1 | Shared | 1.5 GB |
| Flex Consumption | FC1 | 1-4 | 2-4 GB |
| Premium | EP1 | 1 | 3.5 GB |
| Premium | EP2 | 2 | 7 GB |
| Premium | EP3 | 4 | 14 GB |
| Dedicated | B1 | 1 | 1.75 GB |
| Dedicated | S1 | 1 | 1.75 GB |
| Dedicated | P1v3 | 2 | 8 GB |

> ⚠️ **Warning:** Switching between Consumption/Flex and Premium/Dedicated requires creating a new function app. There is no in-place plan change between serverless and non-serverless SKUs. See `azure-upgrade` for migration guidance.
