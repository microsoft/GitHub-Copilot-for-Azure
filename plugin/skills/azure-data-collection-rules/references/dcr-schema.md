# DCR Schema Reference

API version: `2025-05-11` (required for multi-stage transformations).
Earlier API versions support single-stage only (`transformKql` in dataFlows).

## Top-Level Structure

```jsonc
{
    "location": "{azureRegion}",
    "kind": "{kind}",               // See kind table below. Required for all DCR types.
    "properties": {
        "streamDeclarations": { },  // Custom stream schemas
        "dataSources": { },         // What to collect (omit for kind: "Direct")
        "destinations": { },        // Where to send
        "dataFlows": [ ],           // Ingestion-side routing + transforms
        "transformations": [ ]      // Named transform definitions (multi-stage)
    }
}
```

## kind

| Value | Use Case |
|-------|----------|
| `"Linux"` | AMA collecting from Linux VMs/VMSS/containers. Preferred over omitting kind. |
| `"Windows"` | AMA collecting from Windows VMs/VMSS/containers. Preferred over omitting kind. |
| `"Direct"` | Log Ingestion API (apps, scripts, upstream forwarders like Logstash/Fluentbit). Auto-generates `logsIngestion` endpoint. No `dataSources` section. |
| `"WorkspaceTransforms"` | Ingestion-time transforms on diagnostic settings or other non-DCR data. One per workspace. No `dataSources` or `streamDeclarations`. Streams use `Microsoft-Table-{TableName}`. |
| `"AgentSettings"` | Configure AMA agent parameters (not for data collection). |
| `"PlatformTelemetry"` | Export platform metrics. |

See [DCR kinds guide](./dcr-kinds.md) for kind selection logic, available transformation sections, and design order per kind.

## Column Constraints

**Stream declaration columns (input schema):**

| Constraint | Limit |
|---|---|
| Max column name length | 60 characters |
| Max columns per stream | 1,000 |
| Column name format | Must start with a letter. Only alphanumeric characters and underscores (`_`). |
| Reserved names | `_ResourceId`, `id`, `_SubscriptionId`, `TenantId`, `Type`, `UniqueId`, `Title` |

**Destination table columns (output schema):**

| Constraint | Limit |
|---|---|
| Max column name length | 45 characters |
| Max columns per table | 500 |
| `TimeGenerated` (datetime) | **Required in every LA table** (standard and custom). Transformation output must always include this column. |
| Custom columns on standard tables | Must use `_CF` suffix |

**Critical:** The overall transformation flow (processors + `transformKql`) must ensure the final output includes `TimeGenerated` (datetime). This is a prerequisite for all Log Analytics tables. If the input lacks it, the transform must generate it (e.g., `| extend TimeGenerated = now()`).

Stream declaration limits are more permissive than table limits. The transformation flow must map input columns to names/counts that fit within the destination table constraints.

## destinations

```jsonc
"destinations": {
    "logAnalytics": [
        {
            "name": "myWorkspace",
            "workspaceResourceId": "/subscriptions/.../workspaces/{name}",
            "workspaceId": "guid"
        }
    ]
}
```

## dataFlows

Ingestion-side routing and transforms.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `streams` | string[] | Yes | Input streams. Single stream if transform is applied |
| `destinations` | string[] | Yes | References to `destinations` entries |
| `transform` | string | No | Named transformation reference. **Mutually exclusive** with `transformKql` |
| `transformKql` | string | No | Inline KQL expression. **Mutually exclusive** with `transform` |
| `outputStream` | string | Conditional | Target table. `Microsoft-*` for standard, `Custom-*_CL` for custom. Required for non-default routing |

- Multiple dataFlows can consume the same stream (split to different tables)
- One stream can only target one LA workspace per DCR
- A DCR can mix `transform` and `transformKql` across different dataFlows

See [routing rules](./destination-routing.md) for stream-to-table routing patterns.

## transformations

Array of named transformation definitions (multi-stage only).

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique name, referenced by dataSources/dataFlows `transform` |
| `headerProcessor` | object | Yes | Header processor establishing starting schema |
| `processors` | object[] | No | Ordered sequence of transformation processors |

### Context Rules

- **Client-side transforms** (referenced from dataSources): use data-source-specific headers (`header.Syslog`, `header.WindowsEvents`, etc.)
- **Ingestion-side transforms** (referenced from dataFlows): use `header.StandardStream` or `header.CustomStream`
- Same transformation can be reused across multiple data sources/flows if headers are compatible

See [processors-headers.md](./processors-headers.md) and [processors-operations.md](./processors-operations.md) for processor types. See [KQL transforms](./kql-transforms.md) for `transformKql` syntax.

For REST API usage (PUT/GET), see [put-dcr.ps1](../scripts/put-dcr.ps1) and [get-dcr.ps1](../scripts/get-dcr.ps1). API version: `2025-05-11`.
