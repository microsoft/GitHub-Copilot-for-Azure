# Cost Analysis Workflow

Step-by-step instructions for Azure cost analysis.

## Step 0: Validate Prerequisites

**Required Tools:**
- Azure CLI installed and authenticated (`az login`)
- Azure CLI extensions: `costmanagement`, `resource-graph`
- Azure Quick Review (azqr) installed - See [Azure Quick Review](./azure-quick-review.md)

**Required Permissions:**
- Cost Management Reader role
- Monitoring Reader role
- Reader role on subscription/resource group

**Verification commands:**
```powershell
az --version
az account show
az extension show --name costmanagement
azqr version
```

## Step 1: Load Best Practices

```javascript
mcp_azure_mcp_get_azure_bestpractices({
  intent: "Get cost optimization best practices",
  command: "get_bestpractices",
  parameters: { resource: "cost-optimization", action: "all" }
})
```

## Step 1.5: Redis-Specific Analysis (Conditional)

**If user requests Redis cost optimization**, use the specialized Redis skill:
- Reference: [Azure Redis Cost Optimization](./azure-redis.md)
- Report templates in `../templates/`

**When to use Redis-specific analysis:**
- User mentions "Redis", "Azure Cache for Redis", or "Azure Managed Redis"
- Focus is on Redis resource optimization, not general subscription analysis

## Step 1.6: Choose Analysis Scope (for Redis)

Prompt user to select scope:
1. **Specific Subscription ID**
2. **Subscription Name**
3. **Subscription Prefix** (e.g., "CacheTeam")
4. **All My Subscriptions**
5. **Tenant-wide**

## Step 2: Run Azure Quick Review

Reference: [Azure Quick Review](./azure-quick-review.md)

```javascript
extension_azqr({
  subscription: "<SUBSCRIPTION_ID>",
  "resource-group": "<RESOURCE_GROUP>"  // optional
})
```

**What to look for:**
- Orphaned resources: unattached disks, unused NICs, idle NAT gateways
- Over-provisioned resources: excessive retention periods, oversized SKUs
- Missing cost tags

## Step 3: Discover Resources

```powershell
az account show
az resource list --subscription "<SUBSCRIPTION_ID>" --resource-group "<RESOURCE_GROUP>"
```

Use MCP tools for specific services (preferred):
- Storage accounts, Cosmos DB, Key Vaults: use Azure MCP tools
- Redis caches: use mcp_azure_mcp_redis tool
- Web apps, VMs, SQL: use az CLI commands

## Step 4: Query Actual Costs

Get actual cost data from Azure Cost Management API (last 30 days).

**Create `temp/cost-query.json`:**
```json
{"type": "ActualCost", "timeframe": "Custom", "timePeriod": {"from": "<START_DATE>", "to": "<END_DATE>"}, "dataset": {"granularity": "None", "aggregation": {"totalCost": {"name": "Cost", "function": "Sum"}}, "grouping": [{"type": "Dimension", "name": "ResourceId"}]}}
```

> Calculate `<START_DATE>` (30 days ago) and `<END_DATE>` (today) in ISO 8601 format.

**Execute cost query:**
```powershell
New-Item -ItemType Directory -Path "temp" -Force
az rest --method post --url "https://management.azure.com/subscriptions/<SUB>/resourceGroups/<RG>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" --body '@temp/cost-query.json'
```

Save results to `output/cost-query-result<timestamp>.json`.

## Step 5: Validate Pricing

Fetch current pricing from official Azure pricing pages:

```javascript
fetch_webpage({
  urls: ["https://azure.microsoft.com/en-us/pricing/details/container-apps/"],
  query: "pricing tiers and costs"
})
```

**Key services to validate:**
- Container Apps: https://azure.microsoft.com/pricing/details/container-apps/
- Virtual Machines: https://azure.microsoft.com/pricing/details/virtual-machines/
- App Service: https://azure.microsoft.com/pricing/details/app-service/
- Log Analytics: https://azure.microsoft.com/pricing/details/monitor/

> Check for free tier allowances - many Azure services have generous free limits.
