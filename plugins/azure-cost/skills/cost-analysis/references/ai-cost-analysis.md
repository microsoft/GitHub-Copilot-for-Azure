# AI Service Cost Analysis

Use Cost Management billing dimensions for Azure AI and Foundry spend. Do not
claim token-level attribution unless a separate supported metric source returns
token usage for the same resource and period.

1. Confirm the subscription or resource-group scope, period, currency, service,
   and deployment or resource of interest.
2. Call `query_costs` grouped first by `ServiceName`, then narrow with
   `ResourceId`, `MeterCategory`, `MeterSubCategory`, or `Meter` when supported
   at that scope.
3. Use exact values returned by Cost Management for filters. Do not invent a
   model, deployment, project, or token dimension.
4. Preserve currency and period. If rows hit the requested `top`, increase it to
   at most 5000 or narrow scope and state that results may be incomplete.
5. Label billing cost as measured. Label per-request or per-token allocation as
   unavailable unless matching usage metrics were independently returned.

For future spend or planned model pricing, hand off to `cost-estimation`.
