# KQL Query Reference

Essential Kusto Query Language (KQL) queries for diagnosing Azure application issues.

Follow [execution boundaries](execution-boundaries.md). Confirm the actual schema,
exact resource filter and UTC window before use. These workspace-table examples
return bounded aggregates rather than raw exception messages, stack traces or
dependency targets. Replace placeholders with the confirmed scope; use an
approved sanitized category only if additional grouping is necessary.

## Prerequisites

- Application Insights or Log Analytics workspace configured
- Diagnostic settings enabled on Azure resources

---

## Recent Errors

```kql
// Recent errors
AppExceptions
| where TimeGenerated between (datetime(<start-utc>) .. datetime(<end-utc>))
| where _ResourceId =~ "<confirmed-resource-id>"
| summarize errors=count() by bin(TimeGenerated, 5m)
| order by TimeGenerated desc
| take 50
```

## Failed Requests

```kql
// Failed requests
AppRequests
| where Success == false
| where TimeGenerated between (datetime(<start-utc>) .. datetime(<end-utc>))
| where _ResourceId =~ "<confirmed-resource-id>"
| summarize count() by ResultCode
| order by count_ desc
| take 50
```

## Slow Requests

```kql
// Slow requests
AppRequests
| where TimeGenerated between (datetime(<start-utc>) .. datetime(<end-utc>))
| where _ResourceId =~ "<confirmed-resource-id>"
| where DurationMs > 5000
| summarize slowRequests=count(), p95=percentile(DurationMs, 95) by bin(TimeGenerated, 5m)
| order by TimeGenerated desc
| take 50
```

## Dependency Failures

```kql
// Dependency failures
AppDependencies
| where Success == false
| where TimeGenerated between (datetime(<start-utc>) .. datetime(<end-utc>))
| where _ResourceId =~ "<confirmed-resource-id>"
| summarize count() by ResultCode
| order by count_ desc
| take 50
```

---

## Tips

- Always include time filter: `TimeGenerated > ago(Xh)`
- Limit results with `take 50` for large datasets
- Use `summarize` to aggregate data before analyzing

## More Resources

- [KQL Quick Reference](https://learn.microsoft.com/azure/data-explorer/kql-quick-reference)
- [Application Insights Queries](https://learn.microsoft.com/azure/azure-monitor/logs/queries)
