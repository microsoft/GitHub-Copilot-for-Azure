# Comparison queries

Independent comparison commands are unavailable in Azure MCP. These shapes
document inspection of supplied paired evidence only; do not run paired queries
or a selection-vs-remainder analysis as a substitute for the delivered comparison
stage. No before/after mechanism or paired critical-path claim can be established
by this port without that capability.

Read only the needed section. `trace-investigation-contract` owns provider syntax, P/Q
composition, counting, assembly and recovery; do not fork those rules here.
In each example substitute the shared trace fragment T and faithfully retain
the shared span expression S. Omit its block only when P has no span predicate.

## Paired metrics

Trace aggregation stays outside span blocks. Use before/after aliases:

```kql
Traces $$ <<Traces>> $$ <<Traces | summarize before_rows=count(), p50=percentile(duration_nano,50), p95=percentile(duration_nano,95), p99=percentile(duration_nano,99), before_occurrences=sum(span_count) by root_span_name>>
Traces | where error_rate > 0 $$ <<Traces>> $$ <<Traces | summarize before_flags=count() by root_span_name>>
```

Replace the passthrough span block `<<Traces>>` with `<<S>>` when needed. Outcome predicates
append to T; S stays unchanged. Keep the initial paired percentile estimates
as the comparison source; additional sketches can vary.

## Time-separated distributions

Pair one joint distribution, service plus a known version/model/region field;
derive marginals locally using the shared span-occurrence interpretation:

```kql
Traces $$ <<Traces>> $$ <<Traces | summarize before_occurrences=count() by ['span.service.name'], ['span.attributes.service.version']>>
```

`monitor traces query analyze-top-attributes` compares a contained selection
against its remainder, not independently defined windows/populations. It cannot
replace the unavailable comparison, even for adjacent windows.

## GenAI usage pairs

Apply shared producer/units/dedup rules, then pair per-inference input/output
usage and classified tool counts. Use matching verified trace or labelled-record
denominators per window; compare model/workload mix alongside per-inference
usage. Unknown ownership/coverage means unavailable usage in inspected data,
not absence across the account.

## Path pairs

Use observed internal names, shared structural semantics and full P intersection:

```kql
Traces $$ <<Traces | where ['span.name'] == 'A' ~> Traces | where ['span.name'] == 'B'>> $$ <<Traces | summarize before_rows=count() by root_span_name>>
Traces $$ <<Traces | where ['span.name'] == 'B' ~> Traces | where ['span.name'] == 'A'>> $$ <<Traces | summarize before_rows=count() by root_span_name>>
Traces $$ <<Traces | where ['span.name'] == 'B' $$ Traces | where ['span.name'] == 'B'>> $$ <<Traces | summarize before_rows=count() by root_span_name>>
Traces $$ <<Traces | where ['span.name'] == 'A' ~> (Traces | where ['span.name'] == 'B' $$ Traces | where ['span.name'] == 'C')>> $$ <<Traces | summarize before_rows=count() by root_span_name>>
```

## Discriminating confirmation

For latency, floor the BEFORE root p95 to a decimal integer ns cutoff and pair
affected/all versus affected/path counts. For flags, use `error_rate > 0`.
For volume/mix, partition rows/occurrences and duration tails to test whether
the branch accounts for the pool delta or dilutes its tail. Reserve four calls
when both affected denominators still need queries; never repeat the same
branch count as supposed confirmation. Correct disproved explanations.
Before a pair, reserve its submissions and at least one resume per operation
within the stage estimate and caller's remaining hard cap, if specified.
If the pair plus reserves does not fit, submit neither; retain the untested
hypothesis for continuation. Unknown page counts are not a promised drain cost.
If the caller's cap blocks another resume, retain accumulated pages and the
exact pending operation; report incomplete coverage, not a drained result.
