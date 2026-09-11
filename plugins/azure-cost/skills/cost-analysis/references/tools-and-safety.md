# Cost Tool and Safety Guidance

## Tool preference

Use ARM MCP tools exclusively. They provide the supported contract for cost,
forecast, AKS, budget, benefit, and pricing operations. Use Resource Graph's
generate, validate, execute sequence for inventory or change correlation.

Do not construct direct REST calls or Azure CLI equivalents. If the required
ARM MCP operation is unavailable, identify the missing operation and stop that
part of the workflow rather than bypassing the tool contract.

## Evidence labels

| Label | Meaning |
|-------|---------|
| Actual cost | Returned by Cost Management for the selected scope and period. |
| Actual metric | Returned by Azure Monitor or Kubernetes metrics. |
| Retail price | Returned by official Azure retail pricing. |
| Negotiated price | Returned from the user's pricesheet. |
| Estimate | Calculated from stated assumptions. |

Follow Resource Graph `skipToken` pages. For cost tools without a continuation
input, increase `top` within the tool limit or narrow scope and label incomplete
results. For retail pricing, narrow filters when `NextPageLink` is present; do
not invoke the URL directly. Preserve currencies and reporting periods. Do not
turn missing data into zero, combine currencies, or present retail comparisons
as realized savings.

Require explicit approval before writes, purchases, tier changes, stops,
resizes, or deletes. Budget creation additionally requires confirmed scope,
name, amount, period, thresholds, and recipients.
