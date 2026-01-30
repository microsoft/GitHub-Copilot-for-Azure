---
name: azure-kusto
description: Query and analyze big data in Azure Data Explorer (Kusto) using KQL. Use this skill for log analytics, time series analysis, telemetry insights, IoT data exploration, and real-time data investigation across large datasets with sub-second query performance.
---

# Azure Data Explorer (Kusto) Query & Analytics

Execute KQL queries and manage Azure Data Explorer resources for fast, scalable big data analytics.

## When to Use

- User mentions "Kusto", "Azure Data Explorer", "ADX", or "KQL"
- Log analytics, telemetry, or time series analysis requests
- IoT data analysis or security analytics tasks
- Queries on large datasets requiring sub-second performance

## Core Workflow

1. **Discover**: List clusters and databases with `kusto_cluster_list`, `kusto_database_list`
2. **Explore**: Get table schema with `kusto_table_schema_get`
3. **Query**: Execute KQL with `kusto_query`

## Key MCP Tools

| Tool | Purpose |
|------|---------|
| `kusto_cluster_list` | List clusters in subscription |
| `kusto_database_list` | List databases in cluster |
| `kusto_query` | Execute KQL queries |
| `kusto_table_schema_get` | Get table schema |

## Essential KQL

```kql
// Recent events
Events | where Timestamp > ago(1h) | take 100

// Aggregation
Events | summarize count() by EventType, bin(Timestamp, 1h)

// Time series
Telemetry | summarize avg(Value) by bin(Timestamp, 5m) | render timechart
```

## Use Cases

Log analytics, IoT telemetry, security/SIEM, APM, business intelligence

## References

- [KQL Patterns](references/kql-patterns.md) - Query patterns and data fields
- [Best Practices](references/best-practices.md) - Performance optimization and troubleshooting
- [MCP Tools](references/mcp-tools.md) - Tool parameters and CLI fallback