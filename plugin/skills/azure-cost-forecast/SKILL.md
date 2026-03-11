---
name: azure-cost-forecast
description: >-
  Forecast future Azure costs using the Cost Management Forecast API. Builds and
  executes forecast requests with proper time-period guardrails, training-data
  validation, and response interpretation. WHEN: forecast Azure costs, predict
  spending, projected costs, estimate bill, future Azure costs, cost projection,
  budget forecast, end of month costs, how much will I spend. DO NOT USE FOR:
  querying historical costs (use azure-cost-query), reducing costs (use
  azure-cost-optimization).
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Cost Forecast Skill

Construct and execute Azure Cost Management Forecast API requests to project future Azure spending with actual-cost context.

## Quick Reference

| Property | Value |
|----------|-------|
| **API Endpoint** | `POST {scope}/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01` |
| **MCP Tools** | `azure__documentation`, `azure__extension_cli_generate`, `azure__get_azure_bestpractices` |
| **CLI** | `az rest` |
| **Best For** | Future cost projections, budget planning, end-of-month estimates |
| **Related Skills** | [azure-cost-query](../azure-cost-query/SKILL.md), [azure-cost-optimization](../azure-cost-optimization/SKILL.md) |

## When to Use This Skill

- Forecast future Azure spending for subscriptions, resource groups, or billing accounts
- Project end-of-month or end-of-year costs
- Get daily or monthly cost projections
- Include actual costs alongside forecast data for context
- Estimate future budget impact

> ⚠️ **Warning:** If the user wants **historical** cost data, use [azure-cost-query](../azure-cost-query/SKILL.md). If they want to **reduce** costs, use [azure-cost-optimization](../azure-cost-optimization/SKILL.md).

## Key Differences from Query API

| Aspect | Query API | Forecast API |
|--------|-----------|--------------|
| Purpose | Historical cost data | Projected future costs |
| Time period | Past dates only | Must include future dates |
| Grouping | ✅ Up to 2 dimensions | ❌ **Not supported** |
| `includeActualCost` | N/A | Include historical alongside forecast |
| Response columns | Cost, Date, Currency | Cost, Date, **CostStatus**, Currency |
| Max response rows | 5,000/page | 40 rows recommended |
| Timeframe | Multiple presets + Custom | Typically `Custom` only |

## MCP Tools

| Tool | Purpose | Required |
|------|---------|----------|
| `azure__documentation` | Look up Forecast API parameters and reference | Optional |
| `azure__extension_cli_generate` | Generate `az rest` commands for forecast requests | Optional |
| `azure__get_azure_bestpractices` | Get cost management best practices | Optional |

> 💡 **Tip:** Prefer Azure MCP tools over direct CLI commands where possible.

## Workflow

### Step 1: Determine Scope

Same scope URL patterns as the Query API:

| Scope | URL Pattern |
|-------|-------------|
| Subscription | `/subscriptions/<subscription-id>` |
| Resource Group | `/subscriptions/<subscription-id>/resourceGroups/<resource-group>` |
| Management Group | `/providers/Microsoft.Management/managementGroups/<mg-id>` |
| Billing Account | `/providers/Microsoft.Billing/billingAccounts/<billing-account-id>` |

### Step 2: Choose Report Type

`ActualCost` is most common for forecasting. `AmortizedCost` for reservation/savings plan projections.

### Step 3: Set Time Period

> ⚠️ **Warning:** The `to` date **MUST** be in the future. The API returns an error for entirely past date ranges.

- Set `timeframe` to `Custom` and provide `timePeriod` with `from` and `to` dates
- `from` can be in the past — shows actual costs up to today, then forecast to `to`
- Minimum 28 days of historical cost data required for forecast to work
- Maximum forecast period: 10 years

> 📋 **Full rules:** [Guardrails Reference](./references/guardrails.md)

### Step 4: Configure Dataset

- **Granularity**: `Daily` or `Monthly` recommended
- **Aggregation**: Typically `Sum` of `Cost`
- See [Request Body Schema](./references/request-body-schema.md) for full schema

> ⚠️ **Warning:** Grouping is **NOT supported** for forecast. If the user requests a grouped forecast, inform them this is an API limitation and suggest using `azure-cost-query` for grouped historical data instead.

### Step 5: Set Forecast-Specific Options

| Field | Default | Description |
|-------|---------|-------------|
| `includeActualCost` | `true` | Include historical actual costs alongside forecast |
| `includeFreshPartialCost` | `true` | Include partial cost data for recent days. **Requires `includeActualCost: true`** |

### Step 6: Construct and Execute

**Create forecast query file:**

Create `temp/cost-forecast.json` with:
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

**Execute forecast query:**
```powershell
# Create temp folder
New-Item -ItemType Directory -Path "temp" -Force

# Query using REST API
az rest --method post `
  --url "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01" `
  --body '@temp/cost-forecast.json'
```

### Step 7: Interpret Response

The response includes a `CostStatus` column:

| CostStatus | Meaning |
|------------|---------|
| `Actual` | Historical actual cost (when `includeActualCost: true`) |
| `Forecast` | Projected future cost |

> 💡 **Tip:** "Forecast is unavailable for the specified time period" is not an error — it means the scope has insufficient historical data. Suggest using `azure-cost-query` for available data.

## Key Guardrails

| Rule | Constraint |
|------|-----------|
| `to` date | Must be in the future |
| Grouping | ❌ Not supported |
| Min training data | 28 days of historical cost data |
| Max forecast period | 10 years |
| Response row limit | 40 rows recommended |
| `includeFreshPartialCost` | Requires `includeActualCost: true` |
| Monthly + includeActualCost | Requires explicit `timePeriod` |

> 📋 **Full details:** [Guardrails Reference](./references/guardrails.md)

## Error Handling

| Status | Error | Remediation |
|--------|-------|-------------|
| 400 | Can't forecast on the past | Ensure `to` date is in the future. Do not retry. |
| 400 | Missing dataset | Add required `dataset` field. Do not retry. |
| 400 | Invalid dependency | Set `includeActualCost: true` when using `includeFreshPartialCost`. Do not retry. |
| 403 | Forbidden | Needs **Cost Management Reader** role on scope. Do not retry. |
| 424 | Bad training data | Insufficient history; falls back to actual costs if available. Do not retry. |
| 429 | Rate limited | Retry after `Retry-After` header value. **Max 3 retries.** |
| 503 | Service unavailable | Do not retry. Check [Azure Status](https://status.azure.com). |

> 📋 **Full details:** [Error Handling Reference](./references/error-handling.md)

## Examples

### Forecast Rest of Current Month (Daily)

```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<first-of-current-month>",
    "to": "<last-day-of-current-month>"
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

> 💡 **Tip:** Set `from` to the first of the month to see actual costs so far alongside the forecast for remaining days.

📋 More examples: [references/examples.md](./references/examples.md)
