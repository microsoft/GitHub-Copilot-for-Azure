## Azure Storage Cost Optimization

Reference guide for identifying cost savings opportunities in Azure Storage accounts through tier analysis, lifecycle policies, and orphaned resource detection.

## Scope

Resolve subscription names to subscription scope paths. For cross-subscription
requests, process no more than ten accessible subscriptions per batch. Tenant
IDs are not Cost Management scopes.

## Cost Optimization Rules

When analyzing each storage account, apply these prioritized rules:

| Priority | Rule | Detection Logic | Recommendation |
|----------|------|----------------|----------------|
| Critical | Unattached managed disk | `managedBy` is empty | Verify ownership; compare snapshot or removal |
| High | Premium in non-production | Premium SKU with a verified environment tag | Compare Standard options |
| High | No lifecycle policy | No management policy is configured | Model tiering and retention rules |
| High | Hot-only, infrequent access | Verified access data shows >80% inactive for 30+ days | Compare Cool, Cold, and Archive |
| High | Geo-redundant non-production | GRS/GZRS with verified lower durability needs | Compare LRS or ZRS |
| High | Classic account | `kind == 'Storage'` | Assess StorageV2 migration |
| Medium | Long retention | Snapshot, version, or soft-delete retention exceeds policy | Review retention requirements |
| Medium | Missing allocation tags | Confirmed tag keys are absent | Recommend required tags |

Quantify opportunities with actual usage, current cost, and live prices. Do not
use generic savings ranges.

For tier-selection constraints and a starting policy, load
[Lifecycle guidance](storage-lifecycle.md).

## Resource Graph Queries

**Find storage accounts without lifecycle policies:**

Lifecycle policy contents are not queryable through Resource Graph. Use the
applicable ARM MCP storage operation. Do not substitute CLI or direct REST when
the operation is unavailable.

**Find Premium storage accounts in non-production:**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where sku.name contains 'Premium'
| where tags.environment in~ ('dev', 'test', 'staging', 'sandbox')
| project name, resourceGroup, sku=sku.name, tags
```

**Find GRS/GZRS accounts in dev/test (redundancy downgrade candidates):**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where sku.name contains 'GRS' or sku.name contains 'GZRS'
| where tags.environment in~ ('dev', 'test', 'staging')
| project name, resourceGroup, sku=sku.name, location, tags
```

**Find classic (v1) storage accounts:**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where kind =~ 'Storage'
| project name, resourceGroup, location, kind
```

**Find orphaned managed disks (unattached):**

```kql
Resources
| where type =~ 'microsoft.compute/disks'
| where isempty(managedBy)
| project name, resourceGroup, location, diskSizeGb=properties.diskSizeGB, sku=sku.name
```

## Report Templates

### Subscription-Level Summary
Include: subscription name/ID, total monthly storage cost, account count by SKU/tier, total data stored (TB), top issues found.

### Detailed Storage Account Analysis
Include: account name, resource group, SKU/redundancy, kind, monthly cost, capacity (GB), access tier distribution (%), lifecycle policy status, and optimization recommendations.

## ARM MCP Tools

Use Resource Graph operations for inventory and configuration that ARG exposes.
Use ARM MCP storage operations for management policies and access tracking, and
ARM MCP monitoring operations for capacity and transaction metrics. Report an
evidence gap when the needed operation is unavailable.

## Pricing

Use `get_retail_prices` for the requested region, redundancy, tier, and
currency. Include storage, transaction, retrieval, early-deletion, and
rehydration costs when relevant; never rely on embedded rates.
