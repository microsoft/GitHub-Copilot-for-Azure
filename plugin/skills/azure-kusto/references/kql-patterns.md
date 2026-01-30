# KQL Query Patterns

## Pattern 1: Basic Data Retrieval
Fetch recent records from a table with simple filtering.

```kql
Events
| where Timestamp > ago(1h)
| take 100
```

**Use for**: Quick data inspection, recent event retrieval

## Pattern 2: Aggregation Analysis
Summarize data by dimensions for insights and reporting.

```kql
Events
| summarize count() by EventType, bin(Timestamp, 1h)
| order by count_ desc
```

**Use for**: Event counting, distribution analysis, top-N queries

## Pattern 3: Time Series Analytics
Analyze data over time windows for trends and patterns.

```kql
Telemetry
| where Timestamp > ago(24h)
| summarize avg(ResponseTime), percentiles(ResponseTime, 50, 95, 99) by bin(Timestamp, 5m)
| render timechart
```

**Use for**: Performance monitoring, trend analysis, anomaly detection

## Pattern 4: Join and Correlation
Combine multiple tables for cross-dataset analysis.

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

## Pattern 5: Schema Discovery
Use `kusto_table_schema_get` tool to explore table structure before querying.

**Use for**: Understanding data model, query planning

## Common Data Fields

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
