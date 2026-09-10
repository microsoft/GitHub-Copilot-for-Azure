---
name: azure-kusto
description: "Query and analyze data in Azure Data Explorer (Kusto/ADX) using KQL for log analytics, telemetry, and time series analysis. WHEN: KQL queries, Kusto database queries, Azure Data Explorer, ADX clusters, log analytics, time series data, IoT telemetry, anomaly detection."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Data Explorer (Kusto) Query & Analytics

Execute KQL queries and manage Azure Data Explorer resources for fast, scalable big data analytics on log, telemetry, and time series data.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Query my Kusto database for [data pattern]"
- "Show me events in the last hour from Azure Data Explorer"
- "Analyze logs in my ADX cluster"
- "Run a KQL query on [database]"
- "What tables are in my Kusto database?"
- "Show me the schema for [table]"
- "List my Azure Data Explorer clusters"
- "Aggregate telemetry data by [dimension]"
- "Create a time series chart from my logs"

**Key Indicators:**
- Mentions "Kusto", "Azure Data Explorer", "ADX", or "KQL"
- Log analytics or telemetry analysis requests
- Time series data exploration
- IoT data analysis queries
- SIEM or security analytics tasks
- Requests for data aggregation on large datasets
- Performance monitoring or APM queries

## Overview

This skill enables querying and managing Azure Data Explorer (Kusto), a fast and highly scalable data exploration service optimized for log and telemetry data. Azure Data Explorer provides sub-second query performance on billions of records using the Kusto Query Language (KQL).

Key capabilities:
- **Query Execution**: Run KQL queries against massive datasets
- **Schema Exploration**: Discover tables, columns, and data types
- **Resource Management**: List clusters and databases
- **Analytics**: Aggregations, time series, anomaly detection, machine learning

## Core Workflow

1. **Discover Resources**: List available clusters/databases (or Log Analytics workspaces). Enumerate tables before inspecting any one table.
2. **Explore Schema**: Call `kusto_table_schema_get` by name and state returned column names/types. If metadata is ambiguous or unavailable, use a bounded `| take 10` or `| sample 10` query rather than guessing or stopping.
3. **Query Data**: Execute KQL queries and guard rate/percentage denominators, for example `iff(Total == 0, real(null), 100.0 * Failures / Total)`.
4. **Analyze Results**: Never deliver a query alone. Explain what the numbers show and do not establish causally, assumptions such as funnel ordering or null failures, and at least one follow-up dimension or check.

## Query Patterns

### Pattern 1: Basic Data Retrieval
Fetch recent records from a table with simple filtering.

**Example KQL**:
```kql
Events
| where Timestamp > ago(1h)
| take 100
```

**Use for**: Quick data inspection, recent event retrieval

### Pattern 2: Aggregation Analysis
Summarize data by dimensions for insights and reporting.

**Example KQL**:
```kql
Events
| summarize count() by EventType, bin(Timestamp, 1h)
| order by count_ desc
```

**Use for**: Event counting, distribution analysis, top-N queries

### Pattern 3: Time Series Analytics
Analyze data over time windows for trends and patterns.

**Example KQL**:
```kql
Telemetry
| where Timestamp > ago(24h)
| summarize avg(ResponseTime), percentiles(ResponseTime, 50, 95, 99) by bin(Timestamp, 5m)
| render timechart
```

**Use for**: Performance monitoring, trend analysis, anomaly detection

### Pattern 4: Join and Correlation
Combine multiple tables for cross-dataset analysis.

**Example KQL**:
```kql
Events
| where EventType == "Error"
| join kind=inner (
    Logs
    | where Severity == "Critical"
) on CorrelationId
| project Timestamp, EventType, LogMessage, Severity
```

**Use for**: Root cause analysis, correlated event tracking

### Pattern 5: Schema Discovery
Explore table structure before querying.

**Tools**: `kusto_table_schema_get`

**Use for**: Understanding data model, query planning

## Key Data Fields

When executing queries, common field patterns:
- **Timestamp**: Time of event (datetime) - use `ago()`, `between()`, `bin()` for time filtering
- **EventType/Category**: Classification field for grouping
- **CorrelationId/SessionId**: For tracing related events
- **Severity/Level**: For filtering by importance
- **Dimensions**: Custom properties for grouping and filtering

## Result Format

Query results include:
- **Columns**: Field names and data types
- **Rows**: Data records matching query
- **Statistics**: Row count, execution time, resource utilization
- **Visualization**: Chart rendering hints (timechart, barchart, etc.)

## KQL Best Practices

**🟢 Performance Optimized:**
- Filter early with `where` and time scoping before joins and aggregations.
- Bound exploration with `take` or `limit`, and filter on indexed columns first.

**🔵 Query Patterns:**
- Use `summarize` and `bin()` for aggregations and time bucketing; use `project` and `extend` for needed and calculated fields.
- Store frequently used queries as database functions and use materialized views for repeated aggregations.

**🟡 Common Functions:**
- Time filtering: `ago(timespan)` for relative time and `between(start .. end)` for ranges.
- String handling: `startswith()`, `contains()`, and `matches regex` for filtering; `parse` and `extract` for values.
- Aggregations: `percentiles()`, `avg()`, `sum()`, `max()`, and `min()`.

## Best Practices

- Monitor query performance and resource consumption, and apply data retention policies to manage storage costs.
- Use streaming ingestion for real-time analytics (< 1 second latency) and integrate with Azure Monitor for operational insights.

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `kusto_cluster_list` | List all Azure Data Explorer clusters in a subscription |
| `kusto_database_list` | List all databases in a specific Kusto cluster |
| `kusto_query` | Execute KQL queries against a Kusto database |
| `kusto_table_schema_get` | Retrieve schema information for a specific table |

**Required Parameters**:
- `subscription`: Azure subscription ID or display name
- `cluster`: Kusto cluster name (e.g., "mycluster")
- `database`: Database name
- `query`: KQL query string (for query operations)
- `table`: Table name (for schema operations)

**Optional Parameters**:
- `resource-group`: Resource group name (for listing operations)
- `tenant`: Azure AD tenant ID

## Fallback Strategy: Azure CLI Commands

If Azure MCP Kusto tools fail, timeout, or are unavailable, use Azure CLI commands as fallback.

### CLI Command Reference

| Operation | Azure CLI Command |
|-----------|-------------------|
| List clusters | `az kusto cluster list --resource-group <rg-name>` |
| List databases | `az kusto database list --cluster-name <cluster> --resource-group <rg-name>` |
| Show cluster | `az kusto cluster show --name <cluster> --resource-group <rg-name>` |
| Show database | `az kusto database show --cluster-name <cluster> --database-name <db> --resource-group <rg-name>` |

### KQL Query via Azure CLI

For queries, use the Kusto REST API or direct cluster URL:
```bash
az rest --method post \
  --url "https://<cluster>.<region>.kusto.windows.net/v1/rest/query" \
  --body "{ \"db\": \"<database>\", \"csl\": \"<kql-query>\" }"
```

### When to Fallback

Switch to Azure CLI when:
- MCP tool returns timeout error (queries > 60 seconds)
- MCP tool returns "service unavailable" or connection errors
- Authentication failures with MCP tools
- Empty response when database is known to have data

## Common Issues

- **Access Denied**: Verify database permissions (Viewer role minimum for queries)
- **Query Timeout**: Optimize query with time filters, reduce result set, or increase timeout
- **Syntax Error**: Validate KQL syntax - common issues: missing pipes, incorrect operators
- **No Clusters/Tables Found or Resources Unavailable**: Do not stop at clarification. Enumerate accessible clusters, databases or workspaces, and tables; call `kusto_table_schema_get`, or fall back to bounded `| take 10` or `| sample 10`. Provide ready-to-run KQL and explain how expected fields map to discovered columns.
- **Empty Query Results**: Verify the schema and whether the relevant timestamp is event time or ingestion time; widen the time window and relax thresholds before concluding there is no data.
- **Cluster Not Found**: Check cluster name format (exclude ".kusto.windows.net" suffix)
- **High CPU Usage**: Query too broad - add filters, reduce time range, limit aggregations
- **Ingestion Lag**: Streaming data may have 1-30 second delay depending on ingestion method

## Use Cases

- **Log Analytics**: Application logs, system logs, audit logs
- **IoT Analytics**: Sensor data, device telemetry, real-time monitoring
- **Security Analytics**: SIEM data, threat detection, security event correlation
- **APM**: Application performance metrics, user behavior, error tracking
- **Business Intelligence**: Clickstream analysis, user analytics, operational KPIs