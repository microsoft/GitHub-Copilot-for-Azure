# Cost Query Workflow

Use this workflow for cost totals, breakdowns, trends, and top spenders.

## 1. Determine scope and period

Use the narrowest Azure scope that answers the question. `query_costs` defaults
to month-to-date. Custom dates use `YYYY-MM-DD`, must be supplied as a
`from`/`to` pair, and cannot exceed the rolling 92-day lookback.

Supported timeframes are `MonthToDate`, `BillingMonthToDate`, `TheLastMonth`,
`TheLastBillingMonth`, `WeekToDate`, `TheCurrentMonth`, and `Custom`.

## 2. Configure the tool call

| Parameter | Contract |
|---|---|
| `metric` | `PreTaxCost` (default), `Cost`, or `AmortizedCost` |
| `granularity` | `None` (default), `Daily`, or `Monthly` |
| `groupBy` | Up to five comma-separated supported dimensions |
| `filterDimension` + `filterValues` | Supply both; values are comma-separated exact matches |
| `sortBy` | Cost column or selected grouping dimension |
| `sortDirection` | `desc` (default), `asc`, `descending`, or `ascending` |
| `top` | 1-5000 rows; default 100 |

Use [dimensions by scope](dimensions-by-scope.md) to select dimensions.
Resource- and meter-level dimensions require a subscription or resource-group
scope. Tag grouping and filtering are not supported by this MCP tool.

## 3. Execute and interpret

Call `query_costs`; do not construct a REST body or invoke returned URLs.
Preserve the response column order, currency, metric, scope, and period. Keep
different currencies separate.

The tool has no continuation input. If the requested data exceeds `top`, raise
`top` to at most 5000 or narrow the scope, period, or grouping. State when the
result may be incomplete.

## Error handling

| Error | Action |
|---|---|
| Unsupported timeframe, metric, dimension, or sort | Use a value exposed by the tool contract. |
| Missing `from`/`to` or filter pair | Supply both members of the pair. |
| Date outside 92 days | Narrow the period; do not bypass ARM MCP. |
| Throttled | Honor the retry guidance returned by the tool and reduce fan-out. |
| More than about 10 subscriptions | Ask the user to narrow scope. |

See [examples](examples.md), [parameter contract](request-body-schema.md), and
[guardrails](guardrails.md). Use [cost query errors](error-handling.md) for
tool-specific remediation.
