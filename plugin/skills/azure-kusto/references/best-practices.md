# Azure Data Explorer Best Practices

## KQL Performance Optimization

**🟢 Performance Optimized:**
- Filter early: Use `where` before joins and aggregations
- Limit result size: Use `take` or `limit` to reduce data transfer
- Time filters: Always filter by time range for time series data
- Indexed columns: Filter on indexed columns first

**🔵 Query Patterns:**
- Use `summarize` for aggregations instead of `count()` alone
- Use `bin()` for time bucketing in time series
- Use `project` to select only needed columns
- Use `extend` to add calculated fields

**🟡 Common Functions:**
- `ago(timespan)`: Relative time (ago(1h), ago(7d))
- `between(start .. end)`: Range filtering
- `startswith()`, `contains()`, `matches regex`: String filtering
- `parse`, `extract`: Extract values from strings
- `percentiles()`, `avg()`, `sum()`, `max()`, `min()`: Aggregations

## General Best Practices

- Always include time range filters to optimize query performance
- Use `take` or `limit` for exploratory queries to avoid large result sets
- Leverage `summarize` for aggregations instead of client-side processing
- Store frequently-used queries as functions in the database
- Use materialized views for repeated aggregations
- Monitor query performance and resource consumption
- Apply data retention policies to manage storage costs
- Use streaming ingestion for real-time analytics (< 1 second latency)
- Integrate with Azure Monitor for operational insights

## Common Issues

| Issue | Solution |
|-------|----------|
| Access Denied | Verify database permissions (Viewer role minimum for queries) |
| Query Timeout | Optimize query with time filters, reduce result set, or increase timeout |
| Syntax Error | Validate KQL syntax - common issues: missing pipes, incorrect operators |
| Empty Results | Check time range filters (may be too restrictive), verify table name |
| Cluster Not Found | Check cluster name format (exclude ".kusto.windows.net" suffix) |
| High CPU Usage | Query too broad - add filters, reduce time range, limit aggregations |
| Ingestion Lag | Streaming data may have 1-30 second delay depending on ingestion method |
