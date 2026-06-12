# KQL Transform Patterns for DCR Ingestion-Time Transformations

KQL transforms in DCRs operate on a virtual table called `source`. The output of the query defines what gets ingested.

## Syntax Rules

- Always start with `source` (or `let` definitions before `source`)
- Use pipe (`|`) to chain operators
- Output columns must match the destination table schema (or be a subset)
- `TimeGenerated` (datetime) must be present in the final output — required for ALL LA tables. If the input lacks it, generate it (e.g., `| extend TimeGenerated = now()`)
- `let` statements are supported. Right-hand side can be a scalar expression, tabular expression, or user-defined function. Only user-defined functions with scalar arguments are supported.
- `parse` operator is preferred over `extract()` with regex when format is predictable (regex generation is error-prone)
- `parse` is limited to 10 columns per statement (chain multiple `parse` statements if needed)
- No cross-resource `join`, `union`, or `externaldata`
- `summarize` / aggregation not supported (use `aggregate.Basic` processor instead)
- `bag_keys()` not supported

## Transform Pipeline Framework

Standard order for building ingestion-time transforms. Skip steps that don't apply.

```
let definitions         — 0. DEFINE: lookup tables, whitelists, helper functions
source
  |  1. EARLY FILTER    — drop on pre-existing fields (before any compute)
  |  2. PARSE/EXTRACT   — get structured fields from raw data
  |  3. LATE FILTER     — drop on parsed field values
  |  4. ENRICH          — add computed/classified columns, fill defaults
  |  5. NORMALIZE       — typecast, rename columns
  |  6. PROJECT         — explicit final column set matching destination
  v
destination
```

### Mixed event types

**Option A: DCR-level split (preferred)** — Multiple `dataFlows` from the same stream, each with its own `transformKql` and `outputStream`. Max 10 dataFlows per DCR.

**Option B: KQL-level conditional** — Use `case()`/`iff()` inline when event types share a destination and most columns (best for 2-4 variants):

```kql
source
| extend EventType = tostring(parse_json(RawData).type)
| extend
    UserId = iff(EventType in ("auth", "session"), tostring(parse_json(RawData).userId), ""),
    ResourcePath = iff(EventType == "access", tostring(parse_json(RawData).path), "")
| project TimeGenerated, EventType, UserId, ResourcePath
```

Use Option A for different destination tables/schemas. Use Option B for shared schema with minor variants.

### Pipeline performance notes

- `where` is the cheapest operator — push filtering as early as possible
- Use `_cs` (case-sensitive) variants of string operators when literal values have known casing (`startswith_cs`, `contains_cs`, `has_cs`) — avoids case-folding overhead
- `parse` is preferred over `extract()` for readability and reliability (no regex errors)
- `parse_json()` on every row is expensive; if you need only 1-2 fields from a large JSON, `parse` with string matching can be lighter
- `case()` short-circuits: put the most common branch first
- Combine related `extend` calls into one block (comma-separated) to reduce pipe overhead
- Go straight to `project` at the end; use inline renaming (`NewName = OldName`) in `project` to rename columns

## Patterns by Pipeline Stage

### Stage 0: Define (`let`)

**Whitelist for filtering:**

```kql
let allowedApps = datatable(app:string)["web-api", "auth-svc", "worker"];
source
| where AppName in (allowedApps)
```

**Helper function (UDF with scalar args):**

```kql
let classifySeverity = (level:int) {
    case(level >= 6, "Critical", level >= 4, "High", level >= 2, "Medium", "Low")
};
source
| extend Priority = classifySeverity(SeverityNumber)
```

### Stage 1: Early Filter

```kql
source
| where SeverityLevel >= 4
| where Computer !startswith_cs "test-"
```

**Filter using `let`-defined list:**

```kql
let noisyApps = datatable(app:string)["healthcheck", "ping", "warmup"];
source
| where AppName !in (noisyApps)
```

### Stage 2: Parse/Extract

**Parse JSON:**

```kql
source
| extend parsed = parse_json(RawData)
| extend
    UserName = tostring(parsed.user),
    Action = tostring(parsed.action),
    StatusCode = toint(parsed.status)
```

**`parse` operator (preferred for predictable formats):**

Use `*` to skip content before/between/after the target field. Each `parse` is independent of attribute order:

```kql
source
| parse Message with * "User " UserName:string " performed " Action:string " on " Resource:string
```

Parse attributes independently (order-safe, each attribute optional):

```kql
source
| parse Tags with * "region:" Region:string "," *
| parse Tags with * "env:" Environment:string "," *
| parse Tags with * "tier:" Tier:string
```

Chain for >10 columns:

```kql
source
| parse Message with * "src=" SrcIP:string ":" SrcPort:int * " dst=" DstIP:string ":" DstPort:int *
| parse Message with * "proto=" Protocol:string " action=" ActionResult:string
```

**`extract()` with regex (when `parse` insufficient — variable key order, optional keys):**

```kql
source
| extend
    Region = extract(@'(?:^|;)region=([^;]*)', 1, Tags),
    Environment = extract(@'(?:^|;)env=([^;]*)', 1, Tags)
```

### Stage 3: Late Filter

Same as Stage 1, but filtering on fields produced by Stage 2:

```kql
| where StatusCode != 200
```

### Stage 4: Enrich

**Computed classification:**

```kql
| extend Environment = case(
    Computer startswith_cs "prod-", "Production",
    Computer startswith_cs "dev-", "Development",
    "Unknown"
  )
```

**Default values:**

```kql
| extend Region = iif(isempty(Region), "Unknown", Region)
| extend TimeGenerated = iif(isnull(TimeGenerated), now(), TimeGenerated)
```

**Enrich from `let`-defined lookup (use UDF + `case()`):**

```kql
let mapSeverity = (code:int) {
    case(code == 4, "Critical", code == 3, "High", code == 2, "Medium", code == 1, "Low", "Unknown")
};
source
| extend SeverityLabel = mapSeverity(SeverityCode)
```

### Stage 5: Normalize

```kql
| extend StatusCode = toint(StatusCode), Duration = toreal(DurationMs)
```

Renaming is handled in the final `project` step (e.g., `| project HostName = Computer, ...`).

### Stage 6: Project

Explicit final column set. Use inline renaming (`NewCol = OldCol`). Must match destination schema for custom tables.

```kql
| project TimeGenerated, HostName = Computer, UserName, Action, StatusCode
```

### Misc Patterns

**Pass-through (no transform):**

```kql
source
```

**TimeGenerated generation (when source lacks it):**

```kql
source
| extend TimeGenerated = now()
```

**Full pipeline example (all stages):**

```kql
let allowedApps = datatable(app:string)["web-api", "auth-svc", "worker"];
source
| where Facility != "kern"
| parse SyslogMessage with * "app=" AppName:string " " *
| parse SyslogMessage with * "status=" Status:int " " *
| parse SyslogMessage with * "dur=" Duration:real
| where AppName in (allowedApps)
| extend
    StatusBucket = case(Status < 400, "OK", Status < 500, "ClientErr", "ServerErr")
| project TimeGenerated, HostName = Computer, AppName, StatusCode = Status, StatusBucket, DurationMs = Duration
```


## Supported Features Reference

Full list of supported operators, functions, and statements: [Supported KQL features in Azure Monitor transformations](https://learn.microsoft.com/en-us/azure/azure-monitor/data-collection/data-collection-transformations-kql)
