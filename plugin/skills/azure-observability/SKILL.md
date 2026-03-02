---
name: azure-observability
description: >-
  Monitor Azure applications and infrastructure using Azure Monitor, Application
  Insights, Log Analytics, Alerts, and Workbooks. Query metrics, analyze logs
  with KQL, configure alert rules, set up dashboards, and troubleshoot
  performance.
  USE FOR: set up Azure Monitor, configure Application Insights, query logs with KQL,
  create alert rules, build dashboards, analyze metrics, view traces, list/query Log Analytics
  workspaces, show workspace tables, workspace logs.
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

### Required: Azure Subscription Context

**BEFORE calling any monitor MCP command:**

1. **If user provided workspace name** → Use Azure Resource Graph to find it and extract subscription:
   ```yaml
   azure_resources-query_azure_resource_graph
     arg_intent: "find log analytics workspace named <workspace-name> and return its subscription id"
     useDefaultSubscriptionFilter: false
   ```
   Extract subscription ID from the resource ID (format: `/subscriptions/{subscription-id}/resourceGroups/...`)

2. **If no workspace name** → Check if subscription ID is available from prior conversation

3. **If still no subscription** → Search azure.yaml or .azure/.env files for AZURE_SUBSCRIPTION_ID

4. **If still nothing** → Ask user: "Which Azure subscription should I use?"

**Monitor:**
- `azure__monitor` with command `monitor_workspace_list` — List Log Analytics workspaces
- `azure__monitor` with command `monitor_workspace_log_query` — Query logs across entire workspace with KQL
- `azure__monitor` with command `monitor_resource_log_query` — Query logs for specific resource with KQL
- `azure__monitor` with command `monitor_table_list` — List tables in workspace
- `azure__monitor` with command `monitor_table_type_list` — List table types
- `azure__monitor` with command `monitor_metrics_query` — Query metrics for resources
- `azure__monitor` with command `monitor_metrics_definitions` — List available metric definitions
- `azure__monitor` with command `monitor_activitylog_list` — List activity logs for resources
- `azure__monitor` with command `monitor_healthmodels_entity_get` — Get health status of entity
- `azure__monitor` with command `monitor_webtests_get` — Get or list web tests
- `azure__monitor` with command `monitor_webtests_createorupdate` — Create/update availability web tests

**Application Insights:**
- `azure__applicationinsights` with command `applicationinsights_recommendation_list` — List code optimization recommendations from Profiler

**Azure Data Explorer:**

Note: For Log Analytics workspace queries, use `azure__monitor` commands above.
- `azure__kusto` with command `kusto_cluster_list` — List ADX clusters
- `azure__kusto` with command `kusto_cluster_get` — Get cluster details
- `azure__kusto` with command `kusto_database_list` — List databases
- `azure__kusto` with command `kusto_table_list` — List tables
- `azure__kusto` with command `kusto_table_schema` — Get table schema
- `azure__kusto` with command `kusto_sample` — Sample table data
- `azure__kusto` with command `kusto_query` — Execute KQL queries on ADX

**Workbooks:**
- `azure__workbooks` with command `workbooks_list` — List workbooks in resource group
- `azure__workbooks` with command `workbooks_show` — Get workbook details
- `azure__workbooks` with command `workbooks_create` — Create new workbook
- `azure__workbooks` with command `workbooks_update` — Update existing workbook
- `azure__workbooks` with command `workbooks_delete` — Delete workbook (soft delete, 90-day retention)

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
