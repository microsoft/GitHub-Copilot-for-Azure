# Azure MCP capability boundary

This adapter targets merged Azure MCP Monitor commands, not the original
standalone server. Load `trace-investigation-contract` and its transport/capability
reference before executing a workflow. At an unavailable
required step, report the missing capability and the result that cannot be claimed.
Never approximate that step or invent a tool/parameter. Supported query,
selection-versus-remainder top attributes and ordinary critical path remain usable.

# Error blast radius

## Shared execution

Before the first trace query, load the plugin skill `trace-investigation-contract`
by its exact native name; reuse it throughout this investigation/continuation.
It owns provider, P/Q, fragment/count/coverage, TQL, saved-result, budget and
customer-output rules. If native loading fails, stop and report that prerequisite.
Keep `E`/`errorPredicate` for the error outcome: shared `Q` means investigation
narrowing, not the error. Consult only relevant sections of the one local
[error-query reference](query-execution.md) for signature/denominator
binding or propagation detail; routine work stays here.

## Choose the signature

1. Inspect a supplied trace's assembled fragments, not its stored root status.
   Choose one explicit error and state which if unrelated errors coexist.
   Define stable `E` from type/code or message `contains`, dropping request IDs
   and timestamps; do not overfit the example trace's root/operation.
   Without type/message, use observed operation + service + error status.
2. Preserve caller P/Q. If no narrower population is supplied, default to the
   affected stored-root-label groups after discovery and record that choice.
   Let scoped population `S` be P with any Q; keep both original selectors.
   Both cohorts use SAME S. Do not substitute a root for an explicit selector.
3. Error-marked span, HTTP status and business failure are separate signals.
   HTTP 200 requires span Error (`2`) to be error-marked. `Ok`/`Unset` elsewhere
   do not establish business success. Baseline means "without this signature".

## Measure prevalence

4. **Exact impact unavailable.** The delivered workflow requires a distinct-trace
   impact helper for selected/affected subset checks, group denominators and timing buckets.
   Azure MCP has no equivalent. Do not recreate those results by sorting exported rows.
5. Report prevalence, exact per-group denominators and onset/buckets unavailable. Keep
   bounded signature/example evidence separate; missing coverage is not zero impact.
6. From shared assembled/deduplicated detail, filter spans locally with SAME E.
   Count matching service/operation and resource/role contributions by trace ID,
   distinguishing stored-root resource from matching-span resource.
   Label sampled/incomplete detail without replacing independently valid counts.

## Follow propagation

7. Use observed parent IDs to choose at most TWO bounded ancestor/descendant
   or repetition tests, retaining S. Store exact paths and distinct ID counts;
   Cohort shares require independently supplied complete affected/without-signature
   sets and compatible denominators; absent those, retain example observations only.
   Parent-ID links establish recorded direct parents; `~>` is strict ancestry,
   not sibling order. Distinct repeated spans still are not proven retries.
8. Independent comparisons are unavailable. Top attributes can answer only a
   separately scoped selection-versus-remainder question under S. It cannot
   replace the impact helper or approximate a compound E.
   Identify a trace-supported failure mechanism, not causality from association
   or a bottleneck from a span/trace duration ratio.
9. A handled 404/default-off fallback does NOT establish intentional absence:
    missing configuration versus an existing disabled record differs.
    Desired-state conclusions need actual annotation/config evidence; missing
    access is a real prerequisite, not a reason to restart production log loops.
10. If an installed skill can advance the unresolved question, use the shared
    native continuation contract now: change/regression -> `trace-what-changed`,
    delay -> `trace-latency-root-cause`, tool/token behavior -> `trace-agent-behavior-regression`.
    Preserve P/Q and original E; label extra diagnostic outcomes separately.
    Carry counts, timing, paths and error-mechanism evidence without resetting
    the caller budget or replacing a source/access gap with a proposed handoff.

## Answer

Use the shared evidence-backed answer contract: bottom line with E's signature/example
evidence and the unavailable impact result. Report prevalence, a unique-trace headline,
group denominators or timing buckets only from independently supplied complete evidence.
Include account/window/selected scope,
example trace IDs per mechanism, key path-count evidence and mechanism or actual prerequisite.
Say "distinct observed traces across root-operation groups", not failed business
transactions without separate proof. Full TQL/buckets/continuation state remain
internal unless requested. Never fabricate data or give a zero-impact table
when the shared coverage checks leave impact unavailable.
