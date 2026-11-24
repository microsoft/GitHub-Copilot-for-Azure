# Error query details

Read only the relevant section. `trace-investigation-contract` owns provider/TQL,
fragment assembly, deduplication, draining, recovery, budgets and output.
This reference supplies error-specific signature and propagation decisions.

## Signature and cohort binding

For a seed, inspect the error-identifying fields in all available fragments.
Choose an explicit exception/dependency signal; unrelated errors are not one
signature. Prefer stable type/code or message `contains` after dropping request
IDs/timestamps. A usable signature must not be pinned to its seed's root or
operation unless user scope requires it. Without type/message, retain observed
service + operation + error status instead of the service's unrelated errors.

Call the outcome `E`/`errorPredicate`; `Q` is reserved for deliberate narrowing.
Scoped S combines original P/Q. Error numerator is S + E; prevalence denominator
is ALL S with no E filter, including affected IDs. The analytic comparison baseline
is S AND NOT E. Freeze the selectors; do not redefine that comparison baseline
as globally healthy or business-successful from unrelated Ok/Unset spans.
For error-marked HTTP 200 require span status Error. HTTP 404 on an Ok span is
HTTP-status evidence, not an Error-marked span or a proven business failure.

Unscoped signature discovery and the default affected-label denominator:

```kql
Traces | project trace_id, root_span_name, root_span_resource_id, start_time_unix_nano $$ <<Traces | where ERROR_PREDICATE>>
Traces | where root_span_name in ('ROOT_A', 'ROOT_B') | project trace_id, root_span_name
```

These query examples discover a signature and observed label vocabulary only.
Do not compute prevalence, per-label denominators or timing by sorting their
returned rows; the exact impact helper is unavailable in Azure MCP. Inspect
the actual query payload and continuation metadata during signature discovery;
there is no structured-results switch.

Preserve an explicit S rather than substituting these defaults. Intersect E
faithfully: combine same-span population/outcome predicates in one where.
For an error explicitly belonging to structural operand B:

```kql
Traces | project trace_id, root_span_name, start_time_unix_nano $$ <<Traces | where ['span.name'] == 'A' ~> Traces | where ['span.name'] == 'B' and ERROR_PREDICATE>>
Traces | project trace_id, root_span_name $$ <<Traces | where ['span.name'] == 'A' ~> Traces | where ['span.name'] == 'B'>>
```

Do not attach a global error to B merely to fit the DSL, duplicate S, or invent
an extra distinct-span requirement with `$$`. If faithful intersection cannot
be expressed, describe the actual query-language gap instead of changing scope.

## Impact, timing and contributing errors

Exact impact, selected/affected subset verification, group denominators and
fixed-window timing buckets require the unavailable impact helper. Do not recreate
these results by sorting exported rows. Signature and example-trace queries remain
usable; report exact impact unavailable rather than zero.

Root-label groups can overlap; retain their own denominators and never add group
counts into a unique-trace headline. Use a distinct-scope headline only when the
tool returns it independently. Unknown labels remain explicit. Do not call root
labels business transactions.

Filter shared assembled span detail by SAME E before assigning error
service/operation/resource groups. Count trace IDs per group, not spans.
Stored root/fragment resource and matching-span resource are different;
overlapping service groups do not add to the headline. Sampled detail can
identify a candidate mechanism but does not change complete trace counts.

## Propagation and cause

Pick one evidenced ancestor and, if present, one descendant/repeated-operation
candidate from actual parent IDs. At most two bounded structural follow-ups
retain S; these examples are shapes, not a replacement population:

```kql
Traces | project trace_id $$ <<Traces | where ['span.name'] == 'ANCESTOR' ~> Traces | where ERROR_PREDICATE>>
Traces | project trace_id $$ <<Traces | where ['span.name'] == 'DESCENDANT' <~ Traces | where ['span.name'] == 'FAILING_OPERATION' and ['span.service.name'] == 'FAILING_SERVICE'>>
```

Store exact paths and unioned matching IDs, including complete zero matches.
Intersect with saved affected/without-E sets for shares. Parent IDs establish
recorded direct links; ancestry is any depth, not sibling order or cause.
Repetition needs distinct span IDs and is not retry evidence on its own.
When structural coverage is unavailable, complete parent-ID assembly can
support a separately labeled path count, not a claim the skipped query succeeded.

An optional comparison keeps overall S, not just errors, and identical windows.
A compound E may not fit one selection field: skip rather than approximate it.
Reconcile with saved ID evidence; zero selection despite observed errors is
unusable, not recovery. Associations do not prove the initiating cause.

For handled metadata 404s, distinguish a missing record from explicit disablement:
an existing `CreateMetrics=false` record can return 200; catching NotFound and
defaulting metrics off establishes handling, not intended absence. Actual intent
requires the relevant annotation/config revision. Source-version/stack matching
does not attest the deployed revision. Name missing permissions/data truthfully;
do not restart a log loop or promise a skill can obtain inaccessible configuration.

For a deeper investigation, choose the native next skill by the missing
mechanism: change in error prevalence, delay, or agent/tool behavior.
Pass original P/Q and E, cohort/ID unions, time profile, paths, coverage and
the next discriminating query through the shared continuation state.
Any secondary latency/analytic outcome stays separately named; it must not
silently replace E or broaden S. Include the executed result or real blocker
in the one concise customer answer, not a proposed handoff.
