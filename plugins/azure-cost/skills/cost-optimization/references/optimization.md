# Optimization Workflow

1. Call `query_costs` for month-to-date cost grouped by `ServiceName` and
   `ResourceGroupName`. Rank contributors per currency.
2. Use `generate_query`, `validate_query`, then `execute_query` to retrieve
   Azure Advisor cost recommendations and factual resource inventory.
   Never execute an unvalidated Resource Graph query.
3. Split Advisor results into quantified and non-quantified recommendations.
   Use tool-reported savings only; preserve each amount's currency and period.
4. Check SKU-changing recommendations against assigned Azure Policy. Mark each
   target as allowed, blocked, or unknown.
5. If commitments exist, flag rightsizing that may strand reserved capacity and
   load [Commitment Analysis](commitments.md).
6. Present prioritized rightsizing, cleanup, and commitment opportunities with
   evidence, confidence, impact, and next action. Do not invent utilization
   thresholds or classify a resource as idle or underutilized without an
   authoritative recommendation or matching observed metrics.

Load service-specific Resource Graph guidance only when relevant:

- [Azure Cache for Redis](services/redis.md)
- [Azure Storage](services/storage.md)
- [Resource Graph queries](resource-graph.md)
- [Report template](report-template.md)

## Cleanup safety

Inventory signals such as an unattached disk or empty backend pool are
candidates for investigation, not proof that a resource is unused. Surface
owner tags and require owner confirmation before any delete, stop, resize,
tier, or reservation purchase action.

## Pricing

Use `get_retail_prices` for public prices. For negotiated pricesheets, call
`start_pricesheet_download`, poll `get_pricesheet_status`, and keep retail and
negotiated values clearly labeled. Do not claim realized savings from retail
price comparisons alone.
