---
name: azure-cost
description: "Unified Azure cost management: query historical costs, forecast future spending, and optimize to reduce waste. WHEN: \"Azure costs\", \"Azure spending\", \"Azure bill\", \"cost breakdown\", \"cost by service\", \"cost by resource\", \"how much am I spending\", \"show my bill\", \"monthly cost summary\", \"cost trends\", \"top cost drivers\", \"actual cost\", \"amortized cost\", \"forecast spending\", \"projected costs\", \"estimate bill\", \"future costs\", \"budget forecast\", \"end of month costs\", \"how much will I spend\", \"optimize costs\", \"reduce spending\", \"find cost savings\", \"orphaned resources\", \"rightsize VMs\", \"cost analysis\", \"reduce waste\", \"unused resources\", \"optimize Redis costs\", \"cost by tag\", \"cost by resource group\"."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Cost Management Skill

Unified skill for all Azure cost management tasks: querying historical costs, forecasting future spending, and optimizing to reduce waste.

## When to Use This Skill

Activate this skill when user wants to:
- Query or analyze Azure costs (how much am I spending, show my bill, cost breakdown)
- Break down costs by service, resource, location, or tag
- Analyze cost trends over time
- Forecast future Azure spending or project end-of-month costs
- Optimize Azure costs, reduce spending, or find savings
- Find orphaned or unused resources
- Rightsize Azure VMs, containers, or services
- Generate cost optimization reports

## Quick Reference

| Property | Value |
|----------|-------|
| **Query API Endpoint** | `POST {scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01` |
| **Forecast API Endpoint** | `POST {scope}/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01` |
| **MCP Tools** | `azure__documentation`, `azure__extension_cli_generate`, `azure__get_azure_bestpractices` |
| **CLI** | `az rest`, `az monitor metrics list`, `az resource list` |
| **Required Role** | Cost Management Reader + Monitoring Reader + Reader on scope |

## MCP Tools

| Tool | Description | Parameters | When to Use |
|------|-------------|------------|-------------|
| `azure__documentation` | Search Azure documentation | `query` (Required): search terms | Research Cost Management API parameters and options |
| `azure__extension_cli_generate` | Generate Azure CLI commands | `intent` (Required): task description, `cli-type` (Required): `"az"` | Construct `az rest` commands for cost queries |
| `azure__get_azure_bestpractices` | Get Azure best practices | `intent` (Required): optimization context | Inform query design with cost management best practices |

> 💡 **Tip:** Prefer MCP tools over direct CLI commands. Use `az rest` only when MCP tools don't cover the specific operation.

---

## Routing

Read the user's request and follow the appropriate workflow below.

| User Intent | Workflow | Example Prompts |
|-------------|----------|-----------------|
| Understand current costs | [Part 1: Cost Query](#part-1-cost-query-workflow) | "how much am I spending", "cost by service", "show my bill" |
| Reduce costs / find waste | [Part 2: Cost Optimization](#part-2-cost-optimization-workflow) | "optimize costs", "find orphaned resources", "reduce spending" |
| Project future costs | [Part 3: Cost Forecast](#part-3-cost-forecast-workflow) | "forecast costs", "end of month estimate", "how much will I spend" |
| Full cost picture | Parts 1 + 2 + 3 combined | "give me the full picture of my Azure costs" |

> **Important:** When optimizing costs (Part 2), always present the total bill and cost breakdown (Part 1) alongside optimization recommendations. Users want to see both how much they're spending AND where they can save.

---

## Scope Reference (Shared Across All Workflows)

| Scope | URL Pattern |
|-------|-------------|
| Subscription | `/subscriptions/<subscription-id>` |
| Resource Group | `/subscriptions/<subscription-id>/resourceGroups/<resource-group-name>` |
| Management Group | `/providers/Microsoft.Management/managementGroups/<management-group-id>` |
| Billing Account | `/providers/Microsoft.Billing/billingAccounts/<billing-account-id>` |
| Billing Profile | `/providers/Microsoft.Billing/billingAccounts/<billing-account-id>/billingProfiles/<billing-profile-id>` |

> 💡 **Tip:** These are scope paths only — not complete URLs. Combine with the API endpoint and version.

---

## Part 1: Cost Query Workflow

Use this workflow when the user wants to **understand their costs** — breakdowns, trends, totals, top spenders.

### Step 1: Determine Scope

Identify the Azure scope for the cost query from the Scope Reference table above.

### Step 2: Choose Report Type

| Type | Description |
|------|-------------|
| `ActualCost` | Actual billed costs including purchases |
| `AmortizedCost` | Reservation/savings plan costs spread across usage period |
| `Usage` | Usage-based cost data |

### Step 3: Set Timeframe

Use a preset timeframe (e.g., `MonthToDate`, `TheLastMonth`, `TheLastYear`) or `Custom` with a `timePeriod` object.

> ⚠️ **Warning:** Key time period guardrails:
> - **Daily granularity**: max **31 days**
> - **Monthly/None granularity**: max **12 months**
> - `Custom` timeframe **requires** a `timePeriod` object with `from` and `to` dates
> - Future dates in historical queries are silently adjusted (see guardrails for details)
>
> See [guardrails.md](./cost-query/guardrails.md) for the complete set of validation rules.

### Step 4: Configure Dataset

Define granularity, aggregation, grouping, filtering, and sorting in the `dataset` object.

- **Granularity**: `None`, `Daily`, or `Monthly`
- **Aggregation**: Use `Sum` on `Cost` or `PreTaxCost` for total cost
- **Grouping**: Up to **2** `GroupBy` dimensions (e.g., `ServiceName`, `ResourceGroupName`)
- **Filtering**: Use `Dimensions` or `Tags` filters with `Name`, `Operator` (`In`, `Equal`, `Contains`), and `Values` fields
- **Sorting**: Order results by cost or dimension columns

> 💡 **Tip:** Not all dimensions are available at every scope. See [dimensions-by-scope.md](./cost-query/dimensions-by-scope.md) for the availability matrix.

For the full request body schema, see [request-body-schema.md](./cost-query/request-body-schema.md).

### Step 5: Construct and Execute the API Call

Use `az rest` to call the Cost Management Query API.

**Create cost query file:**

Create `temp/cost-query.json` with:
```json
{
  "type": "ActualCost",
  "timeframe": "MonthToDate",
  "dataset": {
    "granularity": "None",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "grouping": [
      {
        "type": "Dimension",
        "name": "ServiceName"
      }
    ]
  }
}
```

**Execute cost query:**
```powershell
# Create temp folder
New-Item -ItemType Directory -Path "temp" -Force

# Query using REST API (more reliable than az costmanagement query)
az rest --method post `
  --url "<scope>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
  --body '@temp/cost-query.json'
```

### Step 6: Handle Pagination and Errors

- The API returns a maximum of **5,000 rows** per page (default: 1,000).
- If `nextLink` is present in the response, follow it to retrieve additional pages.
- Handle rate limiting (HTTP 429) by respecting `Retry-After` headers.

See [error-handling.md](./cost-query/error-handling.md) for the full error reference.

### Cost Query Key Guardrails

| Rule | Constraint |
|------|-----------|
| Daily granularity max range | 31 days |
| Monthly/None granularity max range | 12 months |
| Absolute API max range | 37 months |
| Max GroupBy dimensions | 2 |
| ResourceId grouping scope | Subscription and resource group only — not supported at billing account, management group, or higher scopes |
| Max rows per page | 5,000 |
| Custom timeframe | Requires `timePeriod` with `from`/`to` |
| Filter AND/OR | Must have at least 2 expressions |

### Cost Query Examples

**Cost by service for the current month:**

```powershell
az rest --method post `
  --url "/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
  --body '{
    "type": "ActualCost",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "None",
      "aggregation": {
        "totalCost": { "name": "Cost", "function": "Sum" }
      },
      "grouping": [
        { "type": "Dimension", "name": "ServiceName" }
      ]
    }
  }'
```

For more examples including daily trends, tag-based filtering, and multi-dimension queries, see [examples.md](./cost-query/examples.md).

---

## Part 2: Cost Optimization Workflow

Use this workflow when the user wants to **reduce their costs** — find waste, orphaned resources, rightsizing opportunities.

> **Important:** Always present the total bill and cost breakdown (from Part 1) alongside optimization recommendations.

### Step 0: Validate Prerequisites

**Required Tools:**
- Azure CLI installed and authenticated (`az login`)
- Azure CLI extensions: `costmanagement`, `resource-graph`
- Azure Quick Review (azqr) installed — See [Azure Quick Review](./cost-optimization/azure-quick-review.md)

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

### Step 1: Load Best Practices

```javascript
azure__get_azure_bestpractices({
  intent: "Get cost optimization best practices",
  command: "get_bestpractices",
  parameters: { resource: "cost-optimization", action: "all" }
})
```

### Step 1.5: Redis-Specific Analysis (Conditional)

**If the user specifically requests Redis cost optimization**, use the specialized Redis reference:

**Reference**: [Azure Redis Cost Optimization](./cost-optimization/services/redis/azure-cache-for-redis.md)

**When to use:**
- User mentions "Redis", "Azure Cache for Redis", or "Azure Managed Redis"
- Focus is on Redis resource optimization, not general subscription analysis

> 💡 **Note:** For general subscription-wide optimization, continue with Step 2. For Redis-only analysis, follow the Redis reference document.

### Step 1.6: Choose Analysis Scope (for Redis-specific analysis)

**If performing Redis cost optimization**, ask the user to select:
1. **Specific Subscription ID**
2. **Subscription Name**
3. **Subscription Prefix** (e.g., "CacheTeam")
4. **All My Subscriptions**
5. **Tenant-wide**

Wait for user response before proceeding.

### Step 2: Run Azure Quick Review

Run azqr to find orphaned resources (immediate cost savings):

**Reference**: [Azure Quick Review](./cost-optimization/azure-quick-review.md)

```
mcp_azure_mcp_extension_azqr
  subscription: "<SUBSCRIPTION_ID>"
  resource-group: "<RESOURCE_GROUP>"  // optional
```

**What to look for:**
- Orphaned resources: unattached disks, unused NICs, idle NAT gateways
- Over-provisioned resources: excessive retention periods, oversized SKUs
- Missing cost tags

### Step 3: Discover Resources

Use Azure Resource Graph for efficient cross-subscription resource discovery. See [Azure Resource Graph Queries](./cost-optimization/azure-resource-graph.md) for orphaned resource detection patterns.

```powershell
az account show
az resource list --subscription "<SUBSCRIPTION_ID>" --resource-group "<RESOURCE_GROUP>"
```

### Step 4: Query Actual Costs

Get actual cost data from Azure Cost Management API (last 30 days). Use the Part 1 query workflow with this configuration:

**Create `temp/cost-query.json`:**
```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<START_DATE>",
    "to": "<END_DATE>"
  },
  "dataset": {
    "granularity": "None",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "grouping": [
      {
        "type": "Dimension",
        "name": "ResourceId"
      }
    ]
  }
}
```

> **Action Required**: Calculate `<START_DATE>` (30 days ago) and `<END_DATE>` (today) in ISO 8601 format.

**Execute and save results to `output/cost-query-result<timestamp>.json`.**

> 💡 **Tip:** Also run a cost-by-service query (grouping by `ServiceName`) to present the total bill breakdown alongside optimization recommendations. See [examples.md](./cost-query/examples.md).

### Step 5: Validate Pricing

Fetch current pricing from official Azure pricing pages using `fetch_webpage`:

**Key services to validate:**
- Container Apps: https://azure.microsoft.com/pricing/details/container-apps/
- Virtual Machines: https://azure.microsoft.com/pricing/details/virtual-machines/
- App Service: https://azure.microsoft.com/pricing/details/app-service/
- Log Analytics: https://azure.microsoft.com/pricing/details/monitor/

> **Important**: Check for free tier allowances — many Azure services have generous free limits.

### Step 6: Collect Utilization Metrics

Query Azure Monitor for utilization data (last 14 days) to support rightsizing recommendations:

```powershell
$startTime = (Get-Date).AddDays(-14).ToString("yyyy-MM-ddTHH:mm:ssZ")
$endTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

# VM CPU utilization
az monitor metrics list `
  --resource "<RESOURCE_ID>" `
  --metric "Percentage CPU" `
  --interval PT1H `
  --aggregation Average `
  --start-time $startTime `
  --end-time $endTime
```

### Step 7: Generate Optimization Report

Generate a report to `output/costoptimizereport<YYYYMMDD_HHMMSS>.md` that includes an executive summary, cost breakdown by service, free tier analysis, orphaned resources, prioritized optimization recommendations, and implementation commands. Save cost query results to `output/cost-query-result<YYYYMMDD_HHMMSS>.json` for audit trail, then clean up temporary files.

For the complete report template, see [report-template.md](./cost-optimization/report-template.md).

---

## Part 3: Cost Forecast Workflow

Use this workflow when the user wants to **project future costs**.

> ⚠️ **Warning:** If the user wants **historical** cost data, use Part 1. If they want to **reduce** costs, use Part 2.

### Key Differences from Query API

| Aspect | Query API (Part 1) | Forecast API (Part 3) |
|--------|-----------|--------------|
| Purpose | Historical cost data | Projected future costs |
| Time period | Past dates only | Must include future dates |
| Grouping | Up to 2 dimensions | **Not supported** |
| `includeActualCost` | N/A | Include historical alongside forecast |
| Response columns | Cost, Date, Currency | Cost, Date, **CostStatus**, Currency |
| Max response rows | 5,000/page | 40 rows recommended |
| Timeframe | Multiple presets + Custom | Typically `Custom` only |

### Step 1: Determine Scope

Use the same scope patterns from the Scope Reference table above.

### Step 2: Choose Report Type

`ActualCost` is most common for forecasting. `AmortizedCost` for reservation/savings plan projections.

### Step 3: Set Time Period

> ⚠️ **Warning:** The `to` date **MUST** be in the future.

- Set `timeframe` to `Custom` and provide `timePeriod` with `from` and `to` dates
- `from` can be in the past — shows actual costs up to today, then forecast to `to`
- Minimum 28 days of historical cost data required
- Maximum forecast period: 10 years

> **Full rules:** [Forecast Guardrails](./cost-forecast/guardrails.md)

### Step 4: Configure Dataset

- **Granularity**: `Daily` or `Monthly` recommended
- **Aggregation**: Typically `Sum` of `Cost`
- See [Forecast Request Body Schema](./cost-forecast/request-body-schema.md) for full schema

> ⚠️ **Warning:** Grouping is **NOT supported** for forecast. Suggest using Part 1 for grouped historical data instead.

### Step 5: Set Forecast-Specific Options

| Field | Default | Description |
|-------|---------|-------------|
| `includeActualCost` | `true` | Include historical actual costs alongside forecast |
| `includeFreshPartialCost` | `true` | Include partial cost data for recent days. **Requires `includeActualCost: true`** |

### Step 6: Construct and Execute

**Create `temp/cost-forecast.json`:**
```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<first-of-month>",
    "to": "<last-of-month>"
  },
  "dataset": {
    "granularity": "Daily",
    "aggregation": {
      "totalCost": { "name": "Cost", "function": "Sum" }
    },
    "sorting": [{ "direction": "Ascending", "name": "UsageDate" }]
  },
  "includeActualCost": true,
  "includeFreshPartialCost": true
}
```

**Execute:**
```powershell
New-Item -ItemType Directory -Path "temp" -Force

az rest --method post `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" `
  --body '@temp/cost-forecast.json'
```

### Step 7: Interpret Response

| CostStatus | Meaning |
|------------|---------|
| `Actual` | Historical actual cost (when `includeActualCost: true`) |
| `Forecast` | Projected future cost |

> 💡 **Tip:** "Forecast is unavailable for the specified time period" is not an error — it means the scope has insufficient historical data. Suggest using Part 1 for available data.

### Forecast Key Guardrails

| Rule | Constraint |
|------|-----------|
| `to` date | Must be in the future |
| Grouping | Not supported |
| Min training data | 28 days of historical cost data |
| Max forecast period | 10 years |
| Response row limit | 40 rows recommended |
| `includeFreshPartialCost` | Requires `includeActualCost: true` |
| Monthly + includeActualCost | Requires explicit `timePeriod` |

> **Full details:** [Forecast Guardrails](./cost-forecast/guardrails.md)

### Forecast Error Handling

| Status | Error | Remediation |
|--------|-------|-------------|
| 400 | Can't forecast on the past | Ensure `to` date is in the future. |
| 400 | Missing dataset | Add required `dataset` field. |
| 400 | Invalid dependency | Set `includeActualCost: true` when using `includeFreshPartialCost`. |
| 403 | Forbidden | Needs **Cost Management Reader** role on scope. |
| 424 | Bad training data | Insufficient history; falls back to actual costs if available. |
| 429 | Rate limited | Retry after `x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after` header. **Max 3 retries.** |
| 503 | Service unavailable | Check [Azure Status](https://status.azure.com). |

> **Full details:** [Forecast Error Handling](./cost-forecast/error-handling.md)

For more forecast examples, see [forecast examples](./cost-forecast/examples.md).

---

## Error Handling (Query API)

| HTTP Status | Error | Remediation |
|-------------|-------|-------------|
| 400 | Invalid request body | Check schema, date ranges, and dimension compatibility. |
| 401 | Unauthorized | Verify authentication (`az login`). |
| 403 | Forbidden | Ensure Cost Management Reader role on scope. |
| 404 | Scope not found | Verify scope URL and resource IDs. |
| 429 | Too many requests | Retry after `x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after` header. **Max 3 retries.** |
| 503 | Service unavailable | Check [Azure Status](https://status.azure.com). |

See [error-handling.md](./cost-query/error-handling.md) for detailed error handling including rate limit headers and retry strategies.

---

## Data Classification

- **ACTUAL DATA** = Retrieved from Azure Cost Management API
- **ACTUAL METRICS** = Retrieved from Azure Monitor
- **VALIDATED PRICING** = Retrieved from official Azure pricing pages
- **ESTIMATED SAVINGS** = Calculated based on actual data and validated pricing

## Best Practices

- Always query actual costs first — never estimate or assume
- Always present the total bill alongside optimization recommendations
- Validate pricing from official sources — account for free tiers
- Use REST API for cost queries (more reliable than `az costmanagement query`)
- Save audit trail — include all queries and responses
- Include Azure Portal links for all resources
- For costs < $10/month, emphasize operational improvements over financial savings
- Never execute destructive operations without explicit approval

## Common Pitfalls

- **Assuming costs**: Always query actual data from Cost Management API
- **Ignoring free tiers**: Many services have generous allowances
- **Using wrong date ranges**: 30 days for costs, 14 days for utilization
- **Not showing the bill**: Always present cost breakdown alongside optimization recommendations
- **Cost query failures**: Use `az rest` with JSON body, not `az costmanagement query`

## Safety Requirements

- Get approval before deleting resources
- Test changes in non-production first
- Provide dry-run commands for validation
- Include rollback procedures

## SDK Quick References

- **Redis Management**: [.NET](cost-optimization/sdk/azure-resource-manager-redis-dotnet.md)
