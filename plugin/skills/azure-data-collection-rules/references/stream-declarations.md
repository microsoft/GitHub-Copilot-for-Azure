# Stream Declarations

Defines schemas for custom streams in `streamDeclarations`. Keys must begin with `Custom-`.
Standard streams (`Microsoft-*`) have implicit schemas and need no declaration.

**Critical: Transform-derived streams.** When an agent-based data source (syslog, windowsEventLogs, etc.) has a `transform` reference and the transform modifies the schema (e.g., via `map.Drop`, `map.Rename`, `parse.*`), the output stream must be `Custom-*`. However, this custom stream's schema is **implicitly derived** from the transform's processor chain output. Do NOT declare it in `streamDeclarations`. Only `logFiles` data sources may declare their custom streams here. For direct ingestion (`kind: "Direct"`), custom streams MUST be declared in `streamDeclarations`.

```jsonc
"streamDeclarations": {
    "Custom-MyStream": {
        "columns": [
            { "name": "TimeGenerated", "type": "datetime" },
            { "name": "MyColumn", "type": "string" }
        ]
    }
}
```

**Column types:** `string`, `int`, `long`, `real`, `boolean`, `dynamic`, `datetime`

Column constraints (name length, max fields, reserved names) are in [DCR schema](./dcr-schema.md#column-constraints).
