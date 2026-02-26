---
name: azure-observability
description: >-
  Monitor Azure applications and infrastructure using Azure Monitor, Application
  Insights, Log Analytics, Alerts, and Workbooks. Query metrics, analyze logs
  with KQL, configure alert rules, set up dashboards, and troubleshoot
  performance.
  USE FOR: monitor my app, set up Azure Monitor, configure Application Insights,
  query logs with KQL, create alert rules, build monitoring dashboards, analyze
  metrics, view distributed traces, set up observability, check application
  performance.
  DO NOT USE FOR: instrumenting apps with App Insights SDK code (use
  appinsights-instrumentation), querying Kusto/ADX clusters (use azure-kusto),
  cost analysis (use azure-cost-optimization).
---

# Azure Observability Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Azure Monitor | Metrics, alerts, dashboards | `azure__monitor` | `az monitor` |
| Application Insights | APM, distributed tracing | `azure__applicationinsights` | `az monitor app-insights` |
| Log Analytics | Log queries, KQL | `azure__kusto` | `az monitor log-analytics` |
| Alerts | Notifications, actions | - | `az monitor alert` |
| Workbooks | Interactive reports | `azure__workbooks` | - |

## MCP Server (Preferred)

When Azure MCP is enabled:

### Monitor (azure__monitor)
- `monitor_workspace_list` - List Log Analytics workspaces
- `monitor_workspace_log_query` - Query logs across entire workspace with KQL
- `monitor_resource_log_query` - Query logs for specific resource with KQL
- `monitor_table_list` - List tables in workspace
- `monitor_table_type_list` - List table types
- `monitor_metrics_query` - Query metrics for resources
- `monitor_metrics_definitions` - List available metric definitions
- `monitor_activitylog_list` - List activity logs for resources
- `monitor_healthmodels_entity_get` - Get health status of entity
- `monitor_webtests_get` - Get or list web tests
- `monitor_webtests_createorupdate` - Create/update availability web tests

### Application Insights (azure__applicationinsights)
- `applicationinsights_recommendation_list` - List code optimization recommendations from Profiler

### Azure Data Explorer (azure__kusto)
Note: For Log Analytics workspace queries, use `azure__monitor` commands above.
- `kusto_cluster_list` - List ADX clusters
- `kusto_cluster_get` - Get cluster details
- `kusto_database_list` - List databases
- `kusto_table_list` - List tables
- `kusto_table_schema` - Get table schema
- `kusto_sample` - Sample table data
- `kusto_query` - Execute KQL queries on ADX

### Workbooks (azure__workbooks)
- `workbooks_list` - List workbooks in resource group
- `workbooks_show` - Get workbook details
- `workbooks_create` - Create new workbook
- `workbooks_update` - Update existing workbook
- `workbooks_delete` - Delete workbook (soft delete, 90-day retention)

## CLI Reference

```bash
# List Log Analytics workspaces
az monitor log-analytics workspace list --output table

# Query logs with KQL
az monitor log-analytics query \
  --workspace WORKSPACE_ID \
  --analytics-query "AzureActivity | take 10"

# List Application Insights
az monitor app-insights component list --output table

# List alerts
az monitor alert list --output table

# Query metrics
az monitor metrics list \
  --resource RESOURCE_ID \
  --metric "Percentage CPU"
```

## Common KQL Queries

```kql
// Recent errors
AppExceptions
| where TimeGenerated > ago(1h)
| project TimeGenerated, Message, StackTrace
| order by TimeGenerated desc

// Request performance
AppRequests
| where TimeGenerated > ago(1h)
| summarize avg(DurationMs), count() by Name
| order by avg_DurationMs desc

// Resource usage
AzureMetrics
| where TimeGenerated > ago(1h)
| where MetricName == "Percentage CPU"
| summarize avg(Average) by Resource
```

## Monitoring Strategy

| What to Monitor | Service | Metric/Log |
|-----------------|---------|------------|
| Application errors | App Insights | Exceptions, failed requests |
| Performance | App Insights | Response time, dependencies |
| Infrastructure | Azure Monitor | CPU, memory, disk |
| Security | Log Analytics | Sign-ins, audit logs |
| Costs | Cost Management | Budget alerts |

## SDK Quick References

For programmatic access to monitoring services, see the condensed SDK guides:

- **OpenTelemetry**: [Python](references/sdk/azure-monitor-opentelemetry-py.md) | [TypeScript](references/sdk/azure-monitor-opentelemetry-ts.md) | [Python Exporter](references/sdk/azure-monitor-opentelemetry-exporter-py.md)
- **Monitor Query**: [Python](references/sdk/azure-monitor-query-py.md) | [Java](references/sdk/azure-monitor-query-java.md)
- **Log Ingestion**: [Python](references/sdk/azure-monitor-ingestion-py.md) | [Java](references/sdk/azure-monitor-ingestion-java.md)
- **App Insights Mgmt**: [.NET](references/sdk/azure-mgmt-applicationinsights-dotnet.md)

## Service Details

For deep documentation on specific services:

- Application Insights setup -> `appinsights-instrumentation` skill
- KQL query patterns -> [Log Analytics KQL documentation](https://learn.microsoft.com/azure/azure-monitor/logs/log-query-overview)
- Alert configuration -> [Azure Monitor alerts documentation](https://learn.microsoft.com/azure/azure-monitor/alerts/alerts-overview)
