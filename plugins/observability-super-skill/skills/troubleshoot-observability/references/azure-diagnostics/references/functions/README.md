# Function Apps Troubleshooting

> **Local adaptation:** Follow [execution boundaries](../execution-boundaries.md).
> No app-setting values, instrumentation keys, connection strings or raw log
> dumps. All CLI examples require separate local-execution approval; prefer
> existing authorized telemetry tools and sanitized evidence.

## Find Linked App Insights / Log Analytics

### Prefer confirmed linkage

Reuse a confirmed resource mapping or operator-supplied sanitized linkage.
Resource-group co-location only identifies candidates; it does not prove which
App Insights instance a function uses. Do not fetch app-setting values to infer
linkage. Ask the operator to confirm the destination resource ID privately.

### Inspect the confirmed App Insights resource's workspace linkage

```bash
az monitor app-insights component show --app <appinsights-name> -g <rg-name> \
  --query "workspaceResourceId" -o tsv
```

### Confirm logs are flowing

Confirm the table schema, incident window and known role name before querying.
An aggregate from another app in a shared resource does not prove this app's
telemetry is flowing. For classic App Insights, for example:

```bash
az monitor app-insights query --apps <appinsights-name> -g <rg-name> \
  --analytics-query "traces | where timestamp between (datetime(<start-utc>) .. datetime(<end-utc>)) | where cloud_RoleName == '<confirmed-role-name>' | summarize records=count(), latest=max(timestamp)"
```

For `FunctionAppLogs` (available in Log Analytics only, not App Insights), query the workspace directly:

```bash
az monitor log-analytics query -w <workspace-guid> \
  --analytics-query "FunctionAppLogs | where TimeGenerated between (datetime(<start-utc>) .. datetime(<end-utc>)) | where _ResourceId =~ '<confirmed-function-resource-id>' | summarize records=count(), latest=max(TimeGenerated) by Level | take 50"
```

> **Classic App Insights:** Some function apps have no linked Log Analytics
> workspace. If `FunctionAppLogs` is unavailable, use the confirmed App Insights
> tables/schema or report the gap; do not enable diagnostics or stream raw logs.

Nonzero recent records for the confirmed role/resource establish only that
coverage in the selected window. Empty, stale or partial results are not healthy.
If destination configuration may be wrong, request a sanitized operator-confirmed
destination resource ID, never the connection string.

> ⚠️ **Always prefer querying App Insights or Log Analytics** for function app logs. `az webapp log tail` can stream live logs directly but App Insights provides richer data, historical queries, and correlation across requests.

> 💡 **Tip:** App Insights logs can be delayed by a few minutes. If you don't see recent data, wait 3-5 minutes and query again.

---

## Check Recent Deployments

Correlate issues with recent deployments by listing deployment history:

```bash
az rest --method get \
  --uri "/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.Web/sites/<func-app-name>/deployments?api-version=2023-12-01"
```

Compare deployment timestamps against when errors started appearing in App Insights
to form a hypothesis; timing alone does not establish that a deployment caused it.

---

## Trigger & Durable Function Troubleshooting

- [Trigger & Binding Troubleshooting](triggers.md) - HTTP, Timer, Queue, Blob, Service Bus, and Cosmos DB trigger diagnostics, plus Flex Consumption specifics and SDK conflicts.
- [Durable Functions Troubleshooting](durable.md) - stuck orchestrations, non-determinism violations, timeout/cancellation patterns, and task hub conflicts.
