# Forecast API Error Handling

## HTTP Status Codes

| Status | Error | Cause | Remediation |
|---|---|---|---|
| 400 | Bad Request | Invalid request body, missing `dataset`, past-only dates, invalid field dependency combinations | Check request body structure; ensure `to` date is in the future; verify `includeActualCost`/`includeFreshPartialCost` dependency |
| 401 | Unauthorized | Authentication failure — missing or expired token | Re-authenticate with `az login` or refresh the access token |
| 403 | Forbidden | Insufficient permissions on the scope | Ensure the identity has **Cost Management Reader** role (or higher) on the target scope |
| 404 | Not Found | Invalid scope URL — subscription, resource group, or billing account not found | Verify the scope URL path and resource IDs are correct |
| 424 | Failed Dependency | Bad training data — forecast model cannot compute predictions | Falls back to actual costs if `includeActualCost=true`; otherwise suggest using **azure-cost-query** for historical data |
| 429 | Too Many Requests | Rate limited — QPU quota exceeded | Read `x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after` header and wait before retrying |
| 503 | Service Unavailable | Temporary service issue | Retry after 30 seconds |

## Validation Error Reference

| Error Code | Description | Fix |
|---|---|---|
| `EmptyForecastRequestBody` | Request body is empty or null | Provide a complete request body with `type`, `timeframe`, `timePeriod`, and `dataset` |
| `InvalidForecastRequestBody` | Request body has invalid JSON structure | Check JSON syntax — verify braces, commas, and field names |
| `DontContainsDataSet` | The `dataset` field is missing from the request body | Add the `dataset` object with `granularity` and `aggregation` |
| `DontContainsValidTimeRangeWhileContainsPeriod` | `timePeriod` is present but `from` or `to` is invalid | Ensure both `from` and `to` are valid ISO 8601 datetime strings |
| `DontContainsValidTimeRangeWhileMonthlyAndIncludeCost` | Monthly granularity with `includeActualCost=true` but missing valid `timePeriod` | Add explicit `timePeriod` with valid `from` and `to` dates |
| `DontContainIncludeActualCostWhileIncludeFreshPartialCost` | `includeFreshPartialCost=true` without `includeActualCost=true` | Set `includeActualCost=true` or set `includeFreshPartialCost=false` |
| `CantForecastOnThePast` | Both `from` and `to` dates are in the past | Ensure the `to` date is in the future |

## Forecast-Specific Scenarios

| Scenario | Response | Action |
|---|---|---|
| "Forecast is unavailable for the specified time period" | Valid response with null/empty rows | Not an error — insufficient history (< 28 days). Suggest using **azure-cost-query** for available historical data. |
| "Can't forecast on the past" | 400 error with `CantForecastOnThePast` | Ensure the `to` date is in the future. |
| Bad training data | 424 Failed Dependency | If `includeActualCost=true`, the response falls back to actual cost data only. Otherwise, suggest using **azure-cost-query** for historical data. |
| Parsing exception | 400 Bad Request | Check JSON format — validate braces, quotes, commas, and field types. |

## Retry Strategy

| Status | Retry? | Strategy |
|---|---|---|
| 429 | ✅ Yes | Wait for duration specified in `x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after` header |
| 503 | ✅ Yes | Retry after 30 seconds |
| 424 | ❌ No | Training data issue — retrying will not help. Fall back to actual costs or use **azure-cost-query** |
| 400 | ❌ No | Fix the request body based on the validation error code |
| 401 | ❌ No | Re-authenticate — the token is missing or expired |
| 403 | ❌ No | Grant **Cost Management Reader** role on the target scope |
| 404 | ❌ No | Fix the scope URL — verify subscription, resource group, or billing account IDs |
