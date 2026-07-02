# DCR Kinds Guide

Choose the DCR kind based on the data collection scenario, then use the available transformation sections for that kind.

## Kind Selection

| Scenario | `kind` value | Notes |
|---|---|---|
| Data from Log Ingestion API (apps, scripts, log forwarders like Logstash/Fluentbit) | `Direct` | Endpoints auto-created. See [direct ingestion](./direct-ingestion.md). |
| AMA on Linux VMs/VMSS/containers | `Linux` | Syslog, perf counters, text/JSON log files |
| AMA on Windows VMs/VMSS/containers | `Windows` | Windows event logs, perf counters, IIS logs |
| Ingestion-time transform on diagnostic settings data | `WorkspaceTransforms` | No input stream. One per workspace. Must link DCR ↔ workspace. |

Avoid cross-OS DCRs unless required. Use OS-specific `kind` for AMA DCRs.

## Agent-Based DCRs (`kind: "Linux"` or `kind: "Windows"`)

### Data Source Types

The `dataSources` section defines what to collect. Each data source specifies collection settings, output streams, and optional client-side transform.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique identifier within the DCR |
| `streams` | string[] | Yes | Output streams. `Microsoft-*` for standard, `Custom-*` for custom |
| `transform` | string | No | Reference to a named transformation (multi-stage only) |

| Type | Standard Streams | Key Parameters |
|------|-----------------|----------------|
| `syslog` | `Microsoft-Syslog`, `Microsoft-CommonSecurityLog` | `facilityNames`, `logLevels` |
| `windowsEventLogs` | `Microsoft-Event` | `xPathQueries` |
| `performanceCounters` | `Microsoft-Perf`, `Microsoft-InsightsMetrics` | `samplingFrequencyInSeconds`, `counterSpecifiers` |
| `logFiles` | Custom only | `filePatterns`, `format` ("json" or "text") |
| `iisLogs` | `Microsoft-W3CIISLog` | `logDirectories` |

Multiple data sources of the same type are allowed, each with its own transform and streams.

### Available Transformation Sections (design in this order)

| # | Section | Runs at | Purpose |
|---|---|---|---|
| 1 | `dataSources` native parameters | Agent (pre-collection) | Filter at source: `facilityNames`, `logLevels`, `xPathQueries`, `counterSpecifiers`, `filePatterns`. No cost, no API version requirement. |
| 2 | `dataSources[].transform` reference | Agent (client-side) | Processors: filter, parse, aggregate, map, enrich. Reduces network egress. Requires `transformations` section + API `2025-05-11`+. |
| 3 | `dataFlows[].transformKql` | Pipeline (ingestion-side) | Single-stage KQL transform. Cannot combine with `transform` on same data flow. |
| 4 | `dataFlows[].transform` reference | Pipeline (ingestion-side) | Processor chain on ingestion side. Requires `transformations` section + API `2025-05-11`+. |

Consult [processor heuristics](./processor-heuristics.md) for processor selection, stage placement, and ordering.

## Direct Ingestion DCR (`kind: "Direct"`)

Used when data arrives via the Log Ingestion API, including upstream log forwarding tools (Logstash, Fluentbit, etc.).

Available transformation sections:

| Section | Purpose |
|---|---|
| `streamDeclarations` | Define incoming JSON schema (required, keys must start with `Custom-`) |
| `dataFlows[].transformKql` | KQL to map/filter/transform incoming data to destination schema |

**Not available:** `dataSources`, native filters, client-side processors, `transformations` section.

**Design order:** (1) define input stream schema in `streamDeclarations`, (2) write `transformKql` to map to destination. See [direct ingestion reference](./direct-ingestion.md).

## Workspace Transform DCR (`kind: "WorkspaceTransforms"`)

Adds ingestion-time transformations to data arriving via diagnostic settings or any non-DCR workflow. The transform applies automatically to all data sent to the specified table (unless sent via its own dedicated DCR).

**Critical constraints the agent MUST enforce:**
- Only **one** workspace transform DCR can be linked to a given LA workspace
- Before creating: **check if a workspace transform DCR already exists** for the target workspace (query for DCRs with `kind: "WorkspaceTransforms"` in the same resource group/subscription). If one exists, add the new table transform as an additional `dataFlows` entry to the existing DCR.
- The DCR must reference the workspace as a destination, AND the workspace must be linked back to the DCR via `defaultDataCollectionRuleResourceId`
- No `dataSources` section. Streams use `Microsoft-Table-{TableName}` format.

**Structure:** No `dataSources` section. Streams use `Microsoft-Table-{TableName}` format. Each table transform is a separate `dataFlows` entry. After deploying, link workspace to DCR via `defaultDataCollectionRuleResourceId` property on the workspace resource.

See [processor-heuristics-filters.md](./processor-heuristics-filters.md) for native filter reference.
