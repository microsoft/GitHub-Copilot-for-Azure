## Azure App Service Cost Optimization

Reduce App Service costs through plan rightsizing, idle slot cleanup, and dev/test pricing.

> **Important:** Always present the total bill and cost breakdown (Step 2+ of the [cost optimization workflow](../../workflow.md)) alongside these recommendations — don't produce savings advice from this guide alone.

## Subscription Input Options

Accept any of these to scope the analysis: Subscription ID, Subscription Name, Resource Group, or "All my subscriptions".

## Cost Optimization Rules

| Priority | Rule | Detection Logic | Recommendation | Avg Savings |
|----------|------|----------------|----------------|-------------|
| 🔴 Critical | Stopped App on Paid Plan | Site `properties.state == 'Stopped'` joined to its plan (`serverFarmId`) where the plan's `sku.tier` is not Free/Shared/Dynamic | Delete the app or move it to a Free/Shared plan; if it’s the only app on the plan, delete/scale down the plan | $50-500/mo |
| 🔴 Critical | Empty App Service Plan | Plan has zero apps deployed | Delete the plan | $50-400/mo |
| 🟠 High | Premium in Non-Production | Plan `sku.tier in ['Premium','PremiumV2','PremiumV3']` AND `tags.environment in ['dev','test','staging','sandbox']` | Downgrade to Basic or Standard | $100-600/mo |
| 🟠 High | Idle Deployment Slots | Non-production slots with zero traffic for 14+ days | Delete unused slots (slots share plan workers but increase utilization, driving scale-out) | $30-150/mo |
| 🟠 High | Over-Provisioned Plan | CPU avg <20% AND memory avg <30% over 14 days | Scale down SKU or reduce instance count | $50-400/mo |
| 🟡 Medium | No Auto-Scale Rules | Production plan with fixed instance count >2 | Add auto-scale rules to scale in during low traffic | $30-200/mo |
| 🟡 Medium | Missing Dev/Test Pricing | Dev/test workloads on regular pricing | Apply Azure Dev/Test subscription offer (subscription-level, not plan-level) | 30-55% savings |
| 🟢 Low | Untagged App Service | Missing `environment`, `owner`, or `costCenter` tags | Apply tags for cost allocation | N/A |
| 🟢 Low | Old Deployment Slots | Slots older than 90 days not used for blue-green | Review if still needed | Variable |

## Plan Tier Decision Matrix

| Workload | Recommended Tier | Key Features |
|----------|-----------------|--------------|
| Dev/test, prototypes | Free F1 | No SLA, limited scale (60 CPU-min/day) |
| Light workloads needing an SLA | Basic B1 | 99.95% SLA, dedicated compute, no auto-scale/slots |
| Low-traffic production | Standard S1 | Auto-scale, slots, backups |
| High-traffic production | Premium P1v3 | Better perf, more slots, VNET |
| Isolated compliance | Isolated I1v2 | Private environment, max scale |

## Resource Graph Queries

**Find stopped apps on paid plans (review for deletion or plan downgrade):**

```kql
Resources
| where type =~ 'microsoft.web/sites'
| where properties.state =~ 'Stopped'
| extend planId = tolower(tostring(properties.serverFarmId))
| join kind=inner (
    Resources
    | where type =~ 'microsoft.web/serverfarms'
    | project planId = tolower(id), planSku = tostring(sku.name), planTier = tostring(sku.tier)
  ) on planId
| where planTier !in~ ('Free', 'Shared', 'Dynamic')
| project name, resourceGroup, planSku, planTier
```

**Find empty App Service Plans:**

```kql
Resources
| where type =~ 'microsoft.web/serverfarms'
| where properties.numberOfSites == 0
| project name, resourceGroup, sku=sku.name, location
```

**Find Premium plans in non-production:**

```kql
Resources
| where type =~ 'microsoft.web/serverfarms'
| where sku.tier in~ ('PremiumV2', 'PremiumV3', 'Premium')
| where tags.environment in~ ('dev', 'test', 'staging', 'sandbox')
| project name, resourceGroup, sku=sku.name, tier=sku.tier, tags
```

## Tools & Commands

**Discovery:** Use Azure Resource Graph or `az` CLI for listing App Service resources (the `azure__appservice` MCP tool has limited list support).

**Azure CLI:**
- `az appservice plan list --resource-group <rg>` - List plans
- `az appservice plan show --name <plan> --resource-group <rg>` - Plan details
- `az webapp list --resource-group <rg>` - List web apps
- `az webapp show --name <app> --resource-group <rg>` - App details
- `az webapp deployment slot list --name <app> --resource-group <rg>` - List slots
- `az monitor metrics list --resource <plan-id> --metric CpuPercentage --interval PT1H` - CPU utilization
- `az monitor metrics list --resource <plan-id> --metric MemoryPercentage --interval PT1H` - Memory utilization

## Pricing Quick Reference

Approximate monthly costs (Linux, East US):
- **Free F1**: $0 (60 min CPU/day, 1 GB RAM)
- **Basic B1**: ~$13/mo (1 core, 1.75 GB)
- **Standard S1**: ~$69/mo (1 core, 1.75 GB, auto-scale, slots)
- **Premium P1v3**: ~$138/mo (2 cores, 8 GB, better perf)

Deployment slots share the plan's compute workers (no separate per-slot charge), but extra slots increase resource utilization and can trigger scale-out. Windows plans cost ~30% more than Linux.

Always validate from [official pricing](https://azure.microsoft.com/pricing/details/app-service/).
