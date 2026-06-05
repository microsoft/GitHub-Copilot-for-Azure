# Processor Heuristics: Native Filters & Filtering

Match user intent to the correct filtering approach. **Always prefer native filtering** over processors when possible.

## Native Filter Check (apply BEFORE processor selection)

| Data source type | Native filter parameters | What they can filter | Use `filter.Basic` only when... |
|---|---|---|---|
| `syslog` | `facilityNames`, `logLevels` | Severity levels, syslog facilities | Filtering on non-severity/facility fields (e.g., ProcessName, HostName, Message content) |
| `windowsEventLogs` | `xPathQueries` | Channel, EventID, Level, Provider, Keywords, any `System/*` field | Filtering on EventData content not expressible in XPath, or complex cross-field conditions spanning System and EventData |
| `performanceCounters` | `counterSpecifiers` | Which counters to collect (by object/counter/instance path) | Filtering by counter value thresholds (e.g., CPU > 80%) |
| `logFiles` | `filePatterns` | Which files to ingest (by glob pattern) | Any content-based filtering (always needed since native filter is file-level only) |
| `iisLogs` | `logDirectories` | Which directories to read | Any content-based filtering (status codes, URIs, response times, etc.) |

**Examples of native filter vs. processor:**

| User intent | Data source | Correct approach | Wrong approach |
|---|---|---|---|
| "Only keep Warning and above syslog" | `syslog` | Set `logLevels: ["Warning", "Error", "Critical", "Alert", "Emergency"]` | `filter.Basic` on SeverityNumber |
| "Only collect Security event IDs 4624, 4625" | `windowsEventLogs` | `xPathQueries: ["Security!*[System[(EventID=4624 or EventID=4625)]]"]` | `filter.Basic` on EventNumber |
| "Only System events Level 1-3" | `windowsEventLogs` | `xPathQueries: ["System!*[System[(Level=1 or Level=2 or Level=3)]]"]` | `filter.Basic` on EventLevel |
| "Only collect CPU and memory counters" | `performanceCounters` | `counterSpecifiers: ["\\Processor(_Total)\\% Processor Time", "\\Memory\\Available MBytes"]` | `filter.Basic` on CounterName |
| "Syslog from auth facility where message contains 'failed'" | `syslog` | `facilityNames: ["auth"]` (native) + `filter.Basic` on Message contains "failed" (processor) | Either all-native (can't filter message content) or all-processor (wasteful) |

## Filtering Intent-to-Processor Map

> **Pre-check:** Before recommending `filter.Basic`, verify the intent cannot be satisfied by native data source filters above.

| User says / scenario | Recommended approach | Stage | Rationale |
|---|---|---|---|
| "only keep errors/warnings" (syslog) | **Native:** set `logLevels` | N/A | No processor needed |
| "only certain event IDs" (Windows) | **Native:** set `xPathQueries` with EventID filter | N/A | No processor needed |
| "only certain event levels" (Windows) | **Native:** set `xPathQueries` with Level filter | N/A | No processor needed |
| "only collect specific counters" | **Native:** set `counterSpecifiers` | N/A | No processor needed |
| "reduce volume", "drop noisy logs" (on fields not covered by native filters) | `filter.Basic` | Client-side only | Filter early to save network and ingestion cost |
| "filter after enrichment", "filter by resolved hostname" | `transform.KQL` with `where` | Ingestion-side | `filter.Basic` is client-side only; use KQL for ingestion-side filtering |
| "filter by message content", "keep logs matching pattern" | `filter.Basic` (if `contains`/`==` suffices) or `transform.KQL` (if regex needed) | Client-side / Ingestion-side respectively | `filter.Basic` is client-side only; `transform.KQL` is ingestion-side only |
| "complex filter with string functions" | `transform.KQL` | Ingestion-side | Only `transform.KQL` is available in the pipeline |
