## Azure Redis Cost Optimization

Reference guide for identifying cost savings opportunities in Azure Redis deployments through analysis and targeted scans.

## Scope

Resolve subscription names to subscription scope paths. For cross-subscription
requests, process no more than ten accessible subscriptions per batch. Tenant
IDs are not Cost Management scopes.

## Cost Optimization Rules

When analyzing each cache, apply these prioritized rules:

| Priority | Rule | Detection Logic | Recommendation |
|----------|------|----------------|----------------|
| Critical | Failed Cache | `provisioningState == 'Failed'` | Verify dependencies, then consider removal |
| Critical | Stuck Creating | `provisioningState == 'Creating'` and age >4 hours | Investigate or open a support request |
| High | Premium in Dev | Premium SKU with a verified non-production tag | Compare a Standard SKU |
| High | Enterprise Unused | Enterprise SKU without required modules or clustering | Compare Premium or Standard |
| High | Old Test Cache | Verified test-purpose tag and age >60 days | Review removal or downsizing |
| Medium | Large Dev Cache | Capacity >3 with a verified development tag | Compare smaller capacities |
| Medium | No Expiration Tag | Missing the organization's expiration tag | Recommend a cleanup policy |
| Low | Untagged Resource | Missing confirmed allocation tags | Recommend the required tags |
| Low | Old Cache | Age >365 days | Verify continued ownership and need |

Quantify savings with current cost and live candidate-SKU prices. Do not use
generic savings ranges.

## Report Templates

### Subscription-Level Summary
Quick overview of costs and issues per subscription (use for multi-subscription scans). Include: subscription name/ID, total monthly cost, number of caches, cache count by SKU tier, and top issues found.

### Detailed Cache Analysis
Individual cache breakdown with specific recommendations. Include: cache name, resource group, SKU tier, current cost, memory usage %, CPU usage %, connection count, and specific rightsizing recommendations.

## ARM MCP Tools

Use Resource Graph's `generate_query`, `validate_query`, and `execute_query` to
inventory cache resources and configuration. Use ARM MCP monitoring operations
for utilization metrics when available. If a required metric or mutation is not
available through ARM MCP, report the evidence gap; do not substitute CLI or
direct REST.
