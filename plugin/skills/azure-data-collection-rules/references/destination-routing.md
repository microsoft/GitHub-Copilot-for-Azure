# Destination Routing Rules

Rules governing how streams map to destination tables in Log Analytics.

## Core Routing Rules

| # | Rule | Example |
|---|------|---------|
| 1 | **Standard stream → its default standard table** works implicitly. `outputStream` is optional. | `Microsoft-Syslog` → Syslog table |
| 2 | **Custom stream → custom table** always works. Table name must end with `_CL`. | `Custom-MyLogs` → `Custom-MyLogs_CL` |
| 3 | **Custom stream → supported standard table** works only for tables on the [supported list](#standard-tables-accepting-custom-streams). | `Custom-MyEvents` → `Microsoft-Event` (Event is on the list) |
| 4 | **Custom stream → unsupported standard table** is **not allowed**. Route to a custom table instead (`Custom-*_CL`). In direct ingestion, only custom streams are available, so this is the only option. | Cannot send `Custom-X` to a table not on the supported list → create a custom table |
| 5 | **Standard stream → custom table** requires `outputStream` set to `Custom-{Table}_CL` and a `transformKql` (even a pass-through `"source"` works). Both `outputStream` and `transformKql` are required for this routing. | Split syslog: `Microsoft-Syslog` + `outputStream: "Custom-SyslogArchive_CL"` + `transformKql: "source"` |
| 6 | **`outputStream` is required** when routing to a non-default table. | Routing `Microsoft-Syslog` to `Custom-FilteredSyslog_CL` requires `outputStream` |
| 7 | **One stream → one LA workspace per DCR**. Split/copy to multiple tables in the same workspace is fine. | Multiple dataFlows with different `outputStream` but same workspace destination |
| 8 | **Custom destination tables must exist before DCR deployment.** The DCR references the table by name; if it doesn't exist, deployment or data flow will fail. | Create `Custom-AppLogs_CL` via API/portal before PUT on the DCR |
| 9 | **Destination table schema must accommodate transformation output.** If the transform produces columns not present in the destination table, those columns must be added to the table before deploying the DCR. Applies to both standard tables (use `_CF` suffix) and custom tables. | Transform adds `ParsedHost` → add `ParsedHost_CF` on standard table, or `ParsedHost` on custom table |

**outputStream format:** Standard table default: omit or `Microsoft-{TableName}`. Non-default standard: `Microsoft-{TableName}`. Custom table: `Custom-{TableName}_CL`.

Column constraints: see [DCR schema](./dcr-schema.md#column-constraints).

## Transform-Derived Stream Rules

When an agent-based data source has a `transform` that modifies the output schema (e.g., `map.Drop`, `map.Rename`, `parse.*`):

1. The data source `streams` must use a `Custom-*` stream name (not `Microsoft-*`)
2. This custom stream is **implicitly derived** from the transform output — do NOT add it to `streamDeclarations`
3. The dataFlow routes the `Custom-*` stream to the destination using `outputStream` (e.g., `outputStream: "Microsoft-Syslog"` for standard tables on the supported list)
4. `streamDeclarations` is only for: direct ingestion custom streams, logFiles custom streams, or custom streams not derived from a transform

## Routing Decision Logic

1. **Custom table destination?** Use custom stream. Set `outputStream` to `Custom-{Table}_CL`. Create table before deploying.
2. **Standard table, schema matches exactly?** Use standard stream. `outputStream` optional.
3. **Standard table, transform adds columns?** Add columns with `_CF` suffix before deploying.
4. **Standard table, schema differs, table on [supported list](./supported-tables.md)?** Use custom stream + `outputStream: "Microsoft-{Table}"` + `transformKql` to map.
5. **Standard table, schema differs, NOT on supported list?** Use standard stream + `transformKql` to reshape, or route to custom table instead.
6. **Custom columns on standard table?** Column names must end with `_CF`.
