# Merged analysis commands

Top attributes and ordinary CPA ship in `@azure/mcp@4.0.0-beta.8`.
Discover the actual command/schema at runtime. Common Required parameters:
`workspace`, `resource-group`; Optional: `subscription`, `tenant`.
Both commands use the query-resume operation for `Running` responses.

## Selection versus remainder

`monitor traces query analyze-top-attributes` ranks associations between a
selected subset and the remainder of one overall population/window.
It is not independent before/after or outlier-versus-remaining-slow comparison.

| Parameter | Required/Optional |
|---|---|
| `overall-start-time`, `overall-end-time` | Required: positive UTC window, at most one day |
| `selection-start-time`, `selection-end-time` | Required: contained in overall window |
| `selection-field`, `selection-op`, `selection-value` | Required: discovered field, supported operator, finite number or quoted string literal |
| `overall-query` | Optional: defaults `Traces`, preserve P/Q |
| `top-n` | Optional: default 8, documented 1-1000 values per attribute; not runtime-clamped |
| `max-results` | Optional: default 10000, clamped 1-10000 backend traces |

Use a discovered bare selection field, not an invented `span.` prefix.
Preserve actual selector and remainder: `error_rate > 0` is an indicator,
not equivalent to business failure or another error signature.
Read every returned value before selecting material findings. Ranked
attribute/value counts are not distinct-trace impact denominators or causes.
The backend trace sample limit is not an output-row/value-pagination limit.

## Ordinary critical path

`monitor traces query analyze-critical-path` requires explicit IDs, not a query.

| Parameter | Required/Optional |
|---|---|
| `trace-ids` | Required: 1-1000 complete nonempty distinct IDs |
| `start-time`, `end-time` | Required: covering positive UTC window, at most one day |
| `aggregate-by` | Optional: at most 3 fields, default `span.name` |
| `percentiles` | Optional: at most 5 values from 1-99, default 50/95/99 |
| `max-results` | Optional: default 10, clamped 1-1000 output budget |
| `exclude-subtree-prefixes`, `deprioritize-subtree-prefixes` | Optional: same prefix cannot be in both |
| `resolve-trace-links` | Optional: false |
| `include-samples`, `include-rollups` | Optional: true/false |

Keep complete input IDs and actual payload/coverage. Do not assume the
standalone server's nested JSON fields exist; use returned fields only.
Idle time is unattributed, not CPU/I/O; a trace-duration median is not a CPA
rollup and count-weighted medians are not additive time contributions.
Subtree exclusion hides descendants; it cannot prove children absent.
There is no query-defined or compact CPA mode in the reviewed contract.
Independent comparative CPA is unavailable; separate ordinary calls are
not a replacement for its joined result.
