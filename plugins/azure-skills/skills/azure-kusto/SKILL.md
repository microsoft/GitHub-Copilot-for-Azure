---
name: azure-kusto
description: "Query and analyze data in Azure Data Explorer (Kusto/ADX) using KQL for log analytics, telemetry, and time series analysis. WHEN: KQL queries, Kusto database queries, Azure Data Explorer, ADX clusters, log analytics, time series data, IoT telemetry, anomaly detection."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Data Explorer (Kusto)

## Workflow

1. Resolve subscription, resource group, cluster, and database from input or read-only discovery; never invent identifiers.
2. Inspect table schemas and function signatures. Use only verified names, types, join keys, and parameters.
3. Run read-only, bounded KQL with early filters and limited exploratory output. Mutate only when explicitly requested.
4. Report evidence; distinguish empty results, missing objects, and failures.

## Multi-source Discovery

When location is unknown, derive finite candidates. Batch metadata listing across candidate Kusto databases or Log Analytics workspaces; match exact tables, then query confirmed matches. An empty table is a match. Report "not found" only after checking all candidates; combine matches when required.

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `kusto_cluster_list` | Discover clusters |
| `kusto_database_list` | Discover databases |
| `kusto_table_schema_get` | Verify table schemas |
| `kusto_query` | Run read-only KQL |

Pass discovered identifiers and use tenant or resource group to disambiguate.

## Failure Handling

- Access denied: name the resource and required read permission; do not call it absent.
- Unknown object, syntax, type, or empty results: recheck metadata, context, and bounds; never guess.
- Timeout: narrow time, filter earlier, project fewer columns, or limit results.
- MCP unavailable: report it. If Azure CLI exists, use it for discovery and `az rest` for queries; never present guidance as executed evidence.
