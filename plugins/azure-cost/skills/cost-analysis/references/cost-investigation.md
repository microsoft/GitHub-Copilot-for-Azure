# Cost Investigation

Explain what changed before recommending remediation.

1. Call `query_costs` with daily granularity on the requested window. Compare
   each day with the prior run rate and identify the spike magnitude.
2. Compare equal-length current and prior periods grouped by `ServiceName`.
   Rank absolute deltas per currency. Query `ChargeType` to separate purchases,
   refunds, and recurring usage.
3. For the leading service, use Resource Graph `resourcechanges` near the spike
   window. Run every query through `generate_query`, `validate_query`, then
   `execute_query`. Inspect creates, deletes, SKU changes, and scale events.
4. Resolve likely ownership from resource group and the organization's actual
   owner or cost-allocation tags. Tag names are case-sensitive.
5. Classify the result as recurring or one-time and controllable or expected.
   Report evidence gaps: change history is short-lived and empty results do not
   prove that nothing changed.

Use the [cost-query workflow](cost-query/workflow.md) for limits, pagination,
and query error handling.

## Handoffs

- Overprovisioning or cleanup opportunity: `cost-optimization`.
- Reservation or Savings Plan change: `cost-optimization` commitment workflow.
- AKS driver: [AKS cost analysis](aks-cost-analysis.md).

Present the spike window, amount and percentage change, leading services,
resource changes, likely owner, classification, and one next action.
