# Cost Forecast Errors

Handle errors returned by `forecast_costs`; do not fall back to REST, CLI, or
SDK calls.

| Error | Likely cause | Remediation |
|---|---|---|
| Missing paired parameter | Only one date or filter field supplied | Supply both `from`/`to` or `filterDimension`/`filterValues`. |
| Invalid date | Not `YYYY-MM-DD`, reversed range, start older than 92 days, or span over 92 days | Correct and narrow the period. |
| Unsupported metric | Value is outside `PreTaxCost`, `Cost`, `AmortizedCost` | Select an exposed metric. |
| Unsupported dimension | Filter is outside the cost dimension whitelist | Use `list_dimensions` or remove the filter. |
| Forecast unavailable | Scope lacks usable forecast data | Report unavailability; use `cost-analysis` for history. |
| Unauthorized or forbidden | Authentication or RBAC failure | Reauthenticate or request Cost Management Reader access. |
| Throttled | Excessive Cost Management fan-out | Honor returned retry guidance and reduce calls. |
| MCP server error | Transient service failure | Retry once; then stop and report the trace ID. |

Surface the MCP tool's user-visible error. Do not assume raw HTTP status,
headers, request-body validation codes, or hidden forecast options are available.
