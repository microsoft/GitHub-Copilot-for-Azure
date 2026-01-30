---
name: azure-observability
description: Azure Observability - Monitor, App Insights, Log Analytics, Alerts, Workbooks for metrics and APM.
---

# Azure Observability

## MCP Tools

- `azure__monitor` - `monitor_metrics_query`, `monitor_logs_query`
- `azure__applicationinsights` - `applicationinsights_component_list`
- `azure__kusto` - `kusto_cluster_list`, `kusto_query`
- `azure__workbooks`

**Setup:** `/azure:setup` or `/mcp`

## CLI

```bash
az monitor log-analytics workspace list -o table
az monitor log-analytics query --workspace WORKSPACE_ID --analytics-query "AzureActivity | take 10"
az monitor app-insights component list -o table
az monitor metrics list --resource RESOURCE_ID --metric "Percentage CPU"
```

## Common KQL

```kql
AppExceptions | where TimeGenerated > ago(1h) | project TimeGenerated, Message
AppRequests | summarize avg(DurationMs) by Name | order by avg_DurationMs desc
```

## References

- App Insights setup → `appinsights-instrumentation` skill
- [KQL Docs](https://learn.microsoft.com/azure/azure-monitor/logs/log-query-overview)
- [Alerts Docs](https://learn.microsoft.com/azure/azure-monitor/alerts/alerts-overview)
