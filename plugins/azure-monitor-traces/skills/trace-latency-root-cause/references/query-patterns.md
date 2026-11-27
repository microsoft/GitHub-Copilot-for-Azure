# trace-latency-root-cause - query shapes

Latency-specific shapes only. Dialect rules, placement, draining, recovery and coverage are in
the shared contract's query-execution reference; read that for an unfamiliar shape or an
incomplete result. Read this when a step points here.

## Notation

`P` = `{PT} $$ <<{PS}>>`. `{PT}` is a trace filter starting with `Traces`; `{PS}` is one span
block (`Traces` = no span condition). `P[cohort]` is the exact query returned for that cohort.

- **Trace anchor** (`{PS}` names no span): append `| where duration_nano > <lo> | where duration_nano < <hi>` to `{PT}`.
- **Span anchor** (`{PS}` filters `['span.name']`): anchor `A` is the span the user calls slow
  (`B` in "B under A"); else the first span predicate. Append
  ` and ['span.duration_nano'] > <lo> and ['span.duration_nano'] < <hi>` inside `A`'s `where`.

## Scope table

| User says | Scope part |
|---|---|
| transaction / endpoint | `{PT}`: `Traces \| where root_span_name contains '<word>'` |
| dependency or span | `{PS}`: `Traces \| where ['span.name'] contains '<x>'` or `['span.service.name'] == '<svc>'` |
| attribute | `{PS}`: `Traces \| where ['span.<field>'] == '<v>'` |
| relationship | `{PS}`: `Traces \| where ['span.name'] == '<A>' ~> Traces \| where ['span.name'] == '<B>'` |
| several spans present | predicates joined with `$$` (each matches a different span) |

Discover actual root labels in a bounded projection/summary before filtering; metric
labels can be lowercased independently. Reuse observed trace-store spelling in query
and comparison predicates rather than assuming casing behaves identically in both tools.
An empty result is not absence until a same-window, observed-case control has been checked.

## Calls

**A - duration distribution** (`max-results=1000`):
```kql
{PT} $$ <<{PS}>> $$ <<Traces | summarize c=count(), p25=percentile(duration_nano,25), p50=percentile(duration_nano,50), p95=percentile(duration_nano,95), p99=percentile(duration_nano,99), mx=max(duration_nano) by root_span_name>>
```
Span anchor: same with `['span.duration_nano']` and `by ['span.name']`, plus a second call for
the root mix. The exact cohort helper is unavailable; use this summary for
context, not to rebuild its cohort IDs.

**Root ranking** (fallback only, `max-results=100`):
```kql
Traces $$ <<Traces>> $$ <<Traces | summarize c=count(), p50=percentile(duration_nano,50), p95=percentile(duration_nano,95) by root_span_name>>
```
Rank observed roots by a declared data-derived measure such as `c x p95`; do not
apply fixed count/latency cutoffs or exclude names based on assumed app behavior.

**Trace-duration cohorts unavailable:** this workflow's exact cohort helper has no
merged Azure MCP equivalent. Do not reconstruct its cutoffs or IDs from capped exports.
Supplied complete cohort predicates may be inspected; no invented cohort is permitted.

For matching-span duration rather than trace duration, use the discovered span
duration field and its bounded summary/query shape. Do not apply trace-duration
cutoffs to span values; if complete span-duration cohorts cannot be established
with supported server-side operations, state that boundary rather than sorting
capped exports locally.

**P1 path fingerprint** (`max-results=100`, one per cohort):
`P[cohort] $$ <<Traces | summarize c=count(), p50=percentile(['span.duration_nano'],50) by ['span.service.name'], ['span.name']>>`

**P2 ancestry** (`include-spans=true`, `max-results=300`):
`Traces | where trace_id == '<example_trace_id>' | project ['span.span_id'], ['span.parent_span_id'], ['span.service.name'], ['span.name'], ['span.duration_nano']`

Follow `parent_span_id` from a `D` span to the root. Write `U1 ~> U2 ~> D` and describe it as
"`D` under `U2` under `U1`" - these are observed direct parents in this one trace, but P3's `~>`
only requires ancestry at any depth, so never present it as a call sequence or ordering.

**P3 path prevalence** (`max-results=10`, one per cohort): `P[cohort]` with its span block replaced by
`<<{PS} $$ Traces | where ['span.name'] == '<U1>' ~> Traces | where ['span.name'] == '<D>'>> $$ <<Traces | summarize t=count() by root_span_name>>`
(drop `{PS} $$ ` when `{PS}` is `Traces`). `U1` is the outermost ancestor you kept; `~>` matches
at any depth, so intermediate spans need not be named. For distinct counts, instead project
trace_id at top level and union/deduplicate complete results; aggregation-block `t` is
not a distinct-trace count. Path share = distinct matching IDs / cohort distinct IDs;
if counts are incompatible, report raw observations. If both cohorts return
0 the chain has a gap - retry once with `D`'s immediate parent in place of `U1`.

## Path labels (P1, `per-trace = c / traces`)

| Label | Rule |
|---|---|
| NEW in slow | baseline per-trace < 0.05, slow >= 0.2 |
| GONE in slow | slow < 0.05, baseline >= 0.2 |
| REPEATS | slow >= 1 and >= 1.3x baseline (a loop, fan-out, batch or repeated records - not a retry without retry evidence) |
| SLOWER | slow p50 >= 1.5x baseline p50 and >= 1 ms |

Apply these labels only to supplied complete cohort evidence. Without exact cohorts,
these population/path labels are unavailable. Denominators must be compatible
distinct-trace counts, not an aggregation-block occurrence count.
Keep the top 3 labeled rows by `slow per-trace x slow p50`. If `X` itself is SLOWER, `X` is
confirmed on the population. If nothing is labeled, write "paths identical" and skip P3. Do not
skip P2: step 6 already pulled that span list for the child drill, and it is needed whether or
not P1 labels anything.

## Negligible span anchor

If `A`'s p95 < 1 ms and < 1% of trace p50, `A` cannot explain the latency: move the anchor to
the nearest other span predicate, keep `P`, say which span is now measured, and never attribute
the enclosing delay to `A`.
