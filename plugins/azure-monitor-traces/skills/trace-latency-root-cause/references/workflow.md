# Azure MCP capability boundary

This adapter targets merged Azure MCP Monitor commands, not the original
standalone server. Load `trace-investigation-contract` and its transport/capability
reference before executing a workflow. At an unavailable
required step, report the missing capability and the result that cannot be claimed.
Never approximate that step or invent a tool/parameter. Supported query,
selection-versus-remainder top attributes and ordinary critical path remain usable.

# Latency Root Cause

**Load the plugin skill `trace-investigation-contract` by its exact native name**
before the first trace query, and reuse it throughout this investigation. It carries provider/account handling, `P`/`Q` semantics,
units and terminology, query execution and recovery, stage-vs-chain budget, continuation, and
the answer contract. Everything below is latency-specific and overrides nothing in it.

Latency query shapes - scope table, call shapes, path labels, thresholds - are in
[query shapes](query-patterns.md). Read it when a step says to, not every run.

**Entry.** Scoped question (an operation, dependency, span, attribute or `A ~> B`), or arriving
from `trace-triage-app`: start at 1. Unscoped ("my app is slow", account + window only): run
`trace-triage-app` first, then return here scoped to what it selects. Only if it is unavailable, rank
roots yourself ([query shapes](query-patterns.md)) and say so. Never load `trace-triage-app` late to fill coverage.

Why cohorts: outliers can have a different bottleneck than the broad slow band. Fixing only
the outlier cause misses much of the measured tail, so report each cohort.

## Steps

1. **Scope `P`.** Turn the symptom into one predicate ([query shapes](query-patterns.md) scope table): root span,
   span, attribute, `$$` set, or `A ~> B`. Both cohorts use `P` verbatim; only the latency
   outcome differs. Run call A for the duration distribution.
2. **Percentile cohorts unavailable.** The delivered workflow requires an exact
   latency-cohort helper; Azure MCP has no equivalent. Do not reconstruct its cutoffs,
   counts or IDs from capped exports. Report full baseline/slow/outlier derivation unavailable.
3. **Independent comparison unavailable.** Do not replace comparative CPA or independent
   attribute analysis with separate ordinary calls or selection-versus-remainder semantics.
4. **Ordinary CPA remains usable.** For caller-supplied complete, nonempty cohorts of at
   most 1000 distinct IDs, use `monitor traces query analyze-critical-path`, matching
   grouping/percentiles, `include-samples=false` and `include-rollups=false` when samples
   and service rollups are not needed. There is no query-defined or compact-results mode.
   Inspect actual payload fields; idle time is unattributed, not CPU/I/O. Do not call a
   trace-duration median a critical-path rollup or a count-weighted median estimate additive.
5. **Scope of remaining evidence.** Inspect a supplied slow example trace even when cohort
   helpers are absent, but do not claim a full-population comparison or critical-path share.
6. **Drill to the leaf that holds the time.** Pull the raw span list for one slow example trace
   containing `X` (the P2 shape in [query shapes](query-patterns.md)) - **one query gives the whole trace**, so the
   rest of this step is local computation, not more calls. **Deduplicate records by `span_id`**
   first: one span is commonly exported more than once, so raw records overcount children.
   Take `X`'s span, select the spans whose `parent_span_id` is its `span_id`, and compare their
   durations against `X`'s. The child covering most of `X`'s interval is the next hop; recurse
   on it until no recorded child accounts for the time. That leaf is the answer, not the first
   ancestor that appeared. Keep this example trace's span list - step 7 reuses it rather than
   re-querying.
   - Only when `X` has **no** recorded children in the deduplicated list may you say the time is
     uninstrumented inside it ("add child spans in `<X>`"). A long anchor or coordinator often
     does have recorded descendants - never conclude "uninstrumented" from an aggregate.
   - `exclude-subtree-prefixes` removes `X` **and every descendant**, so it cannot reveal `X`'s
     children. It answers a different question - what else holds the critical path once that
     subtree is gone - and must never be used to prove absent children or a cause.
7. **Paths and attributes.** Reuse the example trace's recorded parent IDs for bounded
   structural checks. Independent slow-versus-baseline and outlier-versus-remaining-slow
   attributes are unavailable. Do not manufacture these cohorts or substitute the whole
   population as a baseline. Top attributes may answer a separately requested
   selection-versus-remainder question; label its actual selection and count units.
8. **Loop, bounded.** Follow-ups are expected, not improvisation: while the question is open,
   keep going on the child, the leaf or exposed metadata. Pick the one query that could
   disprove the top cause, run it, keep or change the hypothesis. Stop when a query stops
   changing the top cause, after 3 rounds, or at this stage's allowance. Say what you tested.
9. **Answer.** Per the shared contract; do not restate its limits here. Table columns: cohort,
   count, bottleneck, and only the further figures the cause actually rests on. Do not repeat a
   number in prose that the table already carries. Mark each figure full-cohort or sampled, keep
   a headline count only from supplied compatible complete cohorts, give example trace IDs per mechanism, and label the cause measured
   bottleneck / trace-supported mechanism / causal proof - as that label on the finding, not a
   second sentence restating the same caveat.
   Include outlier-versus-remaining-slow discriminators/percentages only when supplied
   paired evidence supports them; otherwise name the unavailable comparison result.
   If the top cause is still only a measured bottleneck with no mechanism in traces, continue
   into the skill that can advance it - `trace-what-changed` for a version/region/host skew,
   `trace-error-blast-radius` when errors ride along, `trace-agent-behavior-regression` for model or tool
   spans - and fold its findings into this one answer.
