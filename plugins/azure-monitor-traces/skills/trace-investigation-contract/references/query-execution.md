# Conditional query execution

Read only when constructing an unfamiliar shape, recovering incomplete results,
or assembling fragmented trace detail. The selected specialist owns its formulas
and decisions; these templates preserve the shared contract.

## Server capabilities

Read [Azure MCP capabilities](capabilities.md). Independent compare, exact impact,
latency-cohort derivation, PromQL and Portal building are unavailable. No approximate
replacement is permitted. Use only discovered schemas and the query-resume command
for pending operations.

## Bounded sampling and scope

Use only sampling advertised by the discovered server, including its syntax and
population/coverage semantics. If it exposes `sample_trace(p)`,
0 < p <= 1, as the ENTIRE trace-level `where`; keep P/Q predicates in separate
stages and span membership in its existing block:

```kql
Traces | where sample_trace(0.000001) | project trace_id, duration_nano, error_rate $$ <<Traces | where ['span.service.name'] == 'OBSERVED_SERVICE' and ['span.name'] == 'OBSERVED_OPERATION'>>
```

Shared sampling/coverage rules apply even when this probability is small.
For counts/evidence on the captured set, add its observed IDs as Q instead of
redrawing `sample_trace(p)` and treating the new draw as the same denominator.

## Correct placement

Trace metrics with an attribute population:

```kql
Traces $$ <<Traces | where ['span.service.name'] == 'OBSERVED_SERVICE'>> $$ <<Traces | summarize records=count(), p50=percentile(duration_nano,50), p95=percentile(duration_nano,95) by root_span_name>>
```

Put trace outcomes and Q narrowing in the top-level trace filter. Preserve P's
span expression unchanged; aggregates use the separate final block.
`records` is not an automatically distinct trace count.

Span-entry occurrence metrics:

```kql
Traces $$ <<Traces | where ['span.service.name'] == 'OBSERVED_SERVICE'>> $$ <<Traces | summarize occurrences=count() by ['span.service.name'], ['span.name']>>
```

This includes all spans of matching traces. A `where` inside the aggregation
block does not filter them; use top-level projected detail plus local membership
checks/deduplication for exact matching spans.

```kql
Traces | project trace_id, ['span.span_id'], ['span.parent_span_id'], ['span.service.name'], ['span.name'], ['span.status.code'] $$ <<Traces | where ['span.service.name'] == 'OBSERVED_SERVICE' and ['span.status.code'] == 2>>
```

Use `include-spans=true`. Project the actual hypothesis fields, not just generic
names/status. Unknown required metadata is a prerequisite, not a promised answer.
After selecting IDs under P/Q, fetch all their returned fragments in the same
account/window; do not filter away parents with a stored-root predicate.
For a genuinely oversized/OOM payload, inventory the selected IDs' fragments,
then reduce projections or split columns joined by `(trace_id, span_id)`.
Any root partition must union every inventoried fragment; verify ID sets and
conflicts instead of dropping a worker fragment to make the response smaller.
`count() by trace_id` may yield one per key: count unique keys from a complete
union, never sum those values as a fragment/business population.

## Dialect and boundaries

Every fragment starts with `Traces`. Same-span predicates use `and` in one
`where`; `$$`/ancestry compose span conditions, not arbitrary sibling order.
No `take`, `>=`, `<=`, regex, `ago()/now()`, timespan literals, `bin`, `extend`,
`avg`, `countif`, `dcount` or chained/bare summarize. Alias aggregates and group
by actual fields; sort locally. Do not rely on aggregation-block `order by`.
OR predicates can fail at execution despite validation; prefer a supported `in`
set or a bounded separate query while retaining scope.
Use integer nanoseconds. A strict `< B` / `> B-1` pair covers an integer cutoff
without dropping values exactly at B. Outcome bands must not overlap.

## Draining, recovery and coverage

Union first and resumed pages; a final zero-row page does not erase prior rows.
Resume query and analytic operations with `monitor traces query resume`, preserving
workspace/group, `operation-id` and `include-spans`. Do not replay the original
query/CPA or resubmit its IDs while draining.
A display-sized file is not a new page: read its full result once. If reading
fails, name the actual missing path/permission; do not infer telemetry absence.

Actual result caps, deadline/system flags, failed files or schema skips invalidate
complete totals. All files skipped by schema means unavailable coverage, not zero.
Null aggregates do not prove absence; zero matches need completed usable coverage.
Recover a transient failed read or selected-ID payload within stage bounds.
For broad storage-capped scans, prefer bounded relevant attribute/time Q or smaller
advertised trace sampling, not exhaustive root/prefix/window partitions. Preserve P.
Pending operations still drain; selected example traces still need all returned fragments.
Useful sample-scoped findings need not wait for complete account coverage.

Do not average slice percentiles or sum overlapping root groups. Adjacent query
windows alone do not guarantee disjoint traces. For aggregate slice totals use
schema-confirmed start bounds for half-open [A,B): `start_time_unix_nano > A_NS-1`
and `< B_NS`, computed exactly; otherwise union/deduplicate raw IDs or state the gap.

## Internal continuation state

Retain original question; full AMW resource ID; P and Q; frozen UTC
windows; measurement and analytic outcomes/baselines; example trace IDs; all completed
results, sample selection/probability/order/caps and coverage flags; hypothesis/evidence tier;
next exact tool/query and
parameters; chain attempts/caller cap; stage counters; visited states; common-loaded
marker. Outcome, Q and baseline equivalence are separate fields.
This is context/artifact data, not a full rendered customer handoff.
