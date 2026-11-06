---
name: azure-kusto
description: "Query Azure Data Explorer (ADX/Kusto) with KQL. WHEN: KQL, ADX clusters, logs, telemetry, time series, IoT, or anomaly analysis."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Data Explorer (Kusto)

## Workflow

1. Resolve subscription, cluster, and database from input or read-only discovery; never invent IDs.
2. Verify schemas, signatures, types, keys, and parameters.
3. Use bounded, read-only KQL; mutate only when explicitly requested.
4. Report evidence; distinguish empty, missing, denied, and failed.

## Multi-source Discovery

For unknown locations, batch-list finite Kusto/Log Analytics candidates; inspect exact table matches before querying. Report absence only after all candidates; combine confirmed matches when needed.

## MCP Tools Used

| Tool | Required inputs | Optional inputs |
|------|-----------------|-----------------|
| `kusto_cluster_list` | subscription | resource group, tenant |
| `kusto_database_list` | subscription, resource group, cluster | tenant |
| `kusto_table_schema_get` | subscription, cluster, database, table | resource group, tenant |
| `kusto_query` | subscription, cluster, database, query | resource group, tenant |

Use discovered IDs; never pass a cluster URI and name together.

## Failure Handling

- Denied: name required read permission; do not call the resource absent.
- Missing context/source: ask for minimum input and give read-only next steps plus a bounded template or generic optimization.
- Missing object: check finite candidates; label alternatives, never silently substitute. Use supplied schemas as unverified assumptions; do not claim execution.
- Syntax, type, or empty result: recheck metadata and bounds. Timeout: narrow time, filter/project early, or limit results.
- MCP unavailable: report it; use Azure CLI/`az rest` only if available and distinguish guidance from execution.
