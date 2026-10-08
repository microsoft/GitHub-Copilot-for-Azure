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

1. Resolve subscription, resource group, cluster, and database from input or read-only discovery. Never invent identifiers.
2. Inspect required table schemas and function signatures before writing KQL. Use only verified names, types, join keys, and parameters.
3. Run read-only KQL with early filters, requested time bounds, and limited exploratory output. Mutate nothing unless explicitly requested.
4. Report evidence and distinguish empty results, missing objects, and failures.

## Multi-source Discovery

When location is unknown, derive a finite candidate set. Batch read-only metadata listing across each candidate Kusto database or Log Analytics workspace, match the exact table, then query confirmed matches. An empty table is still a match. Report "not found" only after checking the full set; combine sources when required.

## Azure MCP Contract

Prefer `kusto_cluster_list`, `kusto_database_list`, `kusto_table_schema_get`, and `kusto_query`. Supply required `subscription`, `cluster`, `database`, `table`, or `query`; use `resource-group` and `tenant` to disambiguate. Preserve discovered identifiers.

## Failure Handling

- Access denied: name the resource and required read permission; do not call it absent.
- Unknown object/syntax/type or empty results: recheck metadata, context, and bounds; never guess.
- Timeout: narrow time, filter earlier, project fewer columns, or limit results.
- MCP unavailable: report it. If Azure CLI exists, use it for discovery and `az rest` for queries; never present instructions as executed evidence.
