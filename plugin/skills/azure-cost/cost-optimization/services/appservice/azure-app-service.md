## Azure App Service Cost Optimization

Reference guide for reducing App Service costs through plan rightsizing, idle slot cleanup, and dev/test pricing.

## Cost Optimization Rules

| Priority | Rule | Detection Logic | Recommendation | Avg Savings |
|----------|------|----------------|----------------|-------------|
| 🔴 Critical | Stopped App on Paid Plan | `state == 'Stopped'` AND `sku.tier != 'Free/Shared'` | Delete or move to Free tier (stopped apps still incur plan cost) | $50-500/mo |
| 🔴 Critical | Empty App Service Plan | Plan has zero apps deployed | Delete the plan | $50-400/mo |
| 🟠 High | Premium in Non-Production | `sku.tier in ['PremiumV2','PremiumV3']` AND `tags.environment in ['dev','test','staging']` | Downgrade to Basic or Standard | $100-600/mo |
| 🟠 High | Idle Deployment Slots | Non-production slots with zero traffic for 14+ days | Delete unused slots (each slot = separate app instance cost) | $50-300/mo |
| 🟠 High | Over-Provisioned Plan | CPU avg <20% AND memory avg <30% over 14 days | Scale down SKU or reduce instance count | $50-400/mo |
| 🟡 Medium | No Auto-Scale Rules | Production plan with fixed instance count >2 | Add auto-scale rules to scale in during low traffic | $30-200/mo |
| 🟡 Medium | Missing Dev/Test Pricing | Dev/test workloads on regular pricing | Enable Dev/Test pricing via subscription offer | 30-55% savings |
| 🟡 Medium | Always On for Non-Production | `alwaysOn == true` on dev/test apps | Disable Always On (apps cold-start on first request) | Reduced idle cost |
| 🟢 Low | Untagged App Service | Missing `environment`, `owner`, or `costCenter` tags | Apply tags for cost allocation | N/A |
| 🟢 Low | Old Deployment Slots | Slots older than 90 days not used for blue-green | Review if still needed | Variable |

## Plan Tier Decision Matrix

| Workload | Recommended Tier | Key Features |
|----------|-----------------|--------------|
| Dev/test, prototypes | Free / Basic B1 | No SLA, limited scale |
| Low-traffic production | Standard S1 | Auto-scale, slots, backups |
| High-traffic production | Premium P1v3 | Better perf, more slots, VNET |
| Isolated compliance | Isolated I1v2 | Private environment, max scale |

## Resource Graph Queries

**Find stopped apps on paid plans:**

```kql
Resources
| where type =~ 'microsoft.web/sites'
| where properties.state =~ 'Stopped'
| where isnotempty(properties.serverFarmId)
| project name, resourceGroup, kind, state=properties.state
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

**MCP Tool:** `azure__appservice` for listing and managing App Service resources

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

Each deployment slot runs as a separate instance at full plan cost. Windows plans cost ~30% more than Linux.

Always validate from [official pricing](https://azure.microsoft.com/pricing/details/app-service/).
