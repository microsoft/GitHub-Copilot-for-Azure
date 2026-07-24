# Processor Heuristics: Transforms & Intent Mapping

Intent-to-processor mapping for parsing, schema modification, aggregation, enrichment, and data routing.

## Parsing / Field Extraction

| User says / scenario | Data signal | Recommended processor | Stage |
|---|---|---|---|
| "extract fields from JSON", "parse JSON" | Column contains `{...}` JSON | `parse.JsonPath` | Client-side only |
| "extract from XML", "parse event XML" | Column contains `<...>` XML (e.g., `RawXml` in Windows events) | `parse.XmlPath` | Client-side only |
| "parse CEF", "extract CEF attributes" | Syslog message in CEF format | `parse.CEFAttribute` | Client-side only |
| "extract with regex", "parse custom format" | Unstructured text, no standard format | `transform.KQL` with `extract()` | Ingestion-side only |
| "parse key-value pairs" (JSON object) | Column contains `{"k":"v", ...}` | `parse.JsonPath` (agent, client-side only) or `transform.KQL` with `parse_json()` (ingestion-side) | Client-side for agent-based; ingestion-side for direct ingestion |
| "parse key-value pairs" (delimited string) | Column contains `k=v;k=v` or `k:v, k:v` or similar | `transform.KQL` with `extract()` or `parse` (max 5 vars) | Ingestion-side only. See [KQL KV extraction patterns](./kql-transforms.md#extract-value-from-delimited-key-value-string) |

## Schema Modification

| User says / scenario | Recommended processor | Stage | Notes |
|---|---|---|---|
| "rename column", "change column name" | `map.Rename` | Client-side only |
| "change column type", "cast to int" | `map.Rename` (with `typeAs`) | Client-side only |
| "drop columns", "remove PII columns", "strip sensitive fields" | `map.Drop` | Client-side only (data never leaves VM) |
| "add computed column", "calculate new field" | `transform.KQL` with `extend` | Ingestion-side only |
| "keep only specific columns" | `transform.KQL` with `project` | Ingestion-side only; or `map.Drop` (client-side only) for exclusion-based approach |

## Aggregation / Summarization

| User says / scenario | Recommended processor | Stage | Notes |
|---|---|---|---|
| "aggregate", "summarize", "count events per host" | `aggregate.Basic` | Client-side only (dramatic volume reduction) |
| "average over time window", "min/max per counter" | `aggregate.Basic` | Client-side only |
| "aggregate after enrichment" | Not supported | N/A | `aggregate.Basic` is client-side only; if aggregation depends on enriched fields only available ingestion-side, aggregation is not possible |

**Always** route aggregated output to a custom table (schema changes entirely).

## Enrichment

| User says / scenario | Recommended processor | Stage | Notes |
|---|---|---|---|
| "resolve IP to hostname", "DNS lookup" | `enrich.DNSLookup` | Client-side only (has network access to DNS) |
| "add environment tag", "classify by hostname pattern" | `transform.KQL` with `case`/`extend` | Ingestion-side only |
| "look up geo-location" | Not available as processor; use `transform.KQL` if geo functions supported | Ingestion-side |

## Data Routing / Split / Copy

| User says / scenario | Recommended approach | Notes |
|---|---|---|
| "send to multiple tables" | Multiple `dataFlows` with different `outputStream` | No processor needed; DCR structure handles this |
| "split by severity" | Multiple `dataFlows` with different `transformKql` filters | One flow per destination table |
| "different transforms per destination" | Multiple `dataFlows` consuming same stream | Each flow can have its own transform |
| "send to multiple workspaces" | Separate data sources in AMA DCR (double-ingestion) | Not possible in pipeline or direct DCRs |

## Data Source to Header Mapping

| Data source type | Header processor | Notes |
|---|---|---|
| `syslog` | `header.Syslog` | |
| `windowsEventLogs` | `header.WindowsEvents` | |
| `performanceCounters` (Windows) | `header.WindowsPerformanceCounters` | Cannot mix with Linux in same DCR |
| `performanceCounters` (Linux) | `header.LinuxPerformanceCounters` | Cannot mix with Windows in same DCR |
| `logFiles` (text) | `header.TextLog` | |
| `logFiles` (json) | `header.TextLog` | JSON format still uses TextLog header |
| `iisLogs` | `header.IISLog` | |
| Windows Firewall | `header.WindowsFirewallLog` | |
| Ingestion-side (standard stream) | `header.StandardStream` | Requires `streamId` config |
| Ingestion-side (custom stream) | `header.CustomStream` | Requires `streamId` config |
