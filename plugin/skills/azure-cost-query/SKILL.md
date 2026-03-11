---
name: azure-cost-query
description: >-
  Query and analyze historical Azure cost data using the Cost Management Query API.
  Construct API requests to break down costs by service, resource, location, or tag
  across subscriptions, resource groups, and billing accounts.
  WHEN: query Azure costs, cost breakdown by service, Azure spending, cost by resource group,
  actual cost, amortized cost, cost trends, top cost drivers, cost by subscription,
  how much did I spend, show my Azure bill, cost by tag, monthly cost summary.
  DO NOT USE FOR: forecasting future costs (use azure-cost-forecast),
  reducing costs or optimization recommendations (use azure-cost-optimization).
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Cost Query Skill

Query historical Azure cost data using the Cost Management Query API. Supports cost breakdowns by service, resource, location, tag, and other dimensions across any Azure scope.

## Quick Reference

| Property | Value |
|----------|-------|
| **API Endpoint** | `POST {scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01` |
| **MCP Tools** | `azure__documentation`, `azure__extension_cli_generate`, `azure__get_azure_bestpractices` |
| **CLI** | `az rest` |
| **Best For** | Historical cost analysis, cost breakdowns, spend tracking |
| **Required Role** | Cost Management Reader on target scope |

## When to Use This Skill

Use this skill when the user asks to:

- Query historical cost data for subscriptions, resource groups, or billing accounts
- Break down costs by service, resource, location, or tag
- Analyze cost trends over time (daily or monthly granularity)
- Filter costs by specific dimensions (e.g., service name, charge type)
- Compare actual vs. amortized costs
- Identify top cost drivers across Azure resources
- View a cost summary for a specific time period

> ⚠️ **Warning:** Do **not** use this skill for cost forecasting (use `azure-cost-forecast`) or cost optimization recommendations (use `azure-cost-optimization`).

## MCP Tools

| Tool | Description | When to Use |
|------|-------------|-------------|
| `azure__documentation` | Search Azure documentation | Research Cost Management API parameters and options |
| `azure__extension_cli_generate` | Generate Azure CLI commands | Construct `az rest` commands for cost queries |
| `azure__get_azure_bestpractices` | Get Azure best practices | Inform query design with cost management best practices |

> 💡 **Tip:** Prefer MCP tools over direct CLI commands. Use `az rest` only when MCP tools don't cover the specific operation.

## Workflow

### Step 1: Determine Scope

Identify the Azure scope for the cost query. The scope defines the cost boundary.

| Scope | URL Pattern |
|-------|-------------|
| Subscription | `/subscriptions/<subscription-id>` |
| Resource Group | `/subscriptions/<subscription-id>/resourceGroups/<resource-group-name>` |
| Management Group | `/providers/Microsoft.Management/managementGroups/<management-group-id>` |
| Billing Account | `/providers/Microsoft.Billing/billingAccounts/<billing-account-id>` |
| Billing Profile | `/providers/Microsoft.Billing/billingAccounts/<billing-account-id>/billingProfiles/<billing-profile-id>` |

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
> - Future dates are not allowed for historical queries
>
> See [guardrails.md](./references/guardrails.md) for the complete set of validation rules.

### Step 4: Configure Dataset

Define granularity, aggregation, grouping, filtering, and sorting in the `dataset` object.

- **Granularity**: `None`, `Daily`, or `Monthly`
- **Aggregation**: Use `Sum` on `Cost` or `PreTaxCost` for total cost
- **Grouping**: Up to **2** `GroupBy` dimensions (e.g., `ServiceName`, `ResourceGroupName`)
- **Filtering**: Use `dimensions` filters with `In`, `Equal`, or `Contains` operators
- **Sorting**: Order results by cost or dimension columns

> 💡 **Tip:** Not all dimensions are available at every scope. See [dimensions-by-scope.md](./references/dimensions-by-scope.md) for the availability matrix.

For the full request body schema, see [request-body-schema.md](./references/request-body-schema.md).

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

See [error-handling.md](./references/error-handling.md) for the full error reference.

## Key Guardrails

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

See [guardrails.md](./references/guardrails.md) for the complete guardrails reference.

## Error Handling

| HTTP Status | Error | Remediation |
|-------------|-------|-------------|
| 400 | Invalid request body | Check schema, date ranges, and dimension compatibility. Do not retry. |
| 401 | Unauthorized | Verify authentication (`az login`). Do not retry. |
| 403 | Forbidden | Ensure Cost Management Reader role on scope. Do not retry. |
| 404 | Scope not found | Verify scope URL and resource IDs. Do not retry. |
| 429 | Too many requests | Retry after `Retry-After` header value. **Max 3 retries.** |
| 503 | Service unavailable | Do not retry. Check [Azure Status](https://status.azure.com). |

See [error-handling.md](./references/error-handling.md) for detailed error handling including rate limit headers and retry strategies.

## Examples

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

For more examples including daily trends, tag-based filtering, and multi-dimension queries, see [examples.md](./references/examples.md).

## Related Skills

- **[azure-cost-forecast](../azure-cost-forecast/SKILL.md)** — Forecast future Azure costs
- **[azure-cost-optimization](../azure-cost-optimization/SKILL.md)** — Identify cost savings and optimization recommendations
