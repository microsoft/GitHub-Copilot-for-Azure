# Agent behavior regression: details

Read only the section the main skill points to.

## Cache

- Keys vary by producer, e.g. `gen_ai.usage.cached_tokens`,
  `cached_input_tokens`, `cache_read.input_tokens`; `cache_creation.input_tokens`
  is a separate write metric.
- Use one key per producer and check that aliases agree. Never sum aliases or add
  cache to input/output totals. Report the sum and nonzero spans; say
  "unrecorded" only when no span has a key.
- A span counts as nonzero once if any cache key is nonzero. Many zeros do not
  mean absence.
- Input includes cached tokens where the provider defines it so. If cache exceeds
  input on any span, report the subset relation as unverified.

## Reduction

- Per unit, compute: total tokens, mean, nearest-rank p50/p95, inference spans,
  tool spans by tool, model mix, and error-bearing units (each counted once).
- Strata: compare the same agent across cohorts. A pooled p50 across different
  agent mixes is confounded.
- Decomposition: `delta = Σ(extra inferences) + Σ(matched T_after − T_before)`.
  Value unmatched inferences at that agent's mean, and state how.
- Missing parents mean a workflow claim is not possible. Repeated tool spans are
  repetition candidates, not retries, until retry attributes or an ordered
  error sequence confirm them.

## Structural

```kql
Traces | project trace_id $$ <<Traces | where ['span.name'] == '<agent-or-inference>' ~> Traces | where ['span.name'] == '<tool-or-service>'>>
```

- `X ~> Y` means X is a strict ancestor at any depth; `<~` is the reverse.
  `X ~> (Y $$ Z)` shares X. Put `P`'s span predicates in the same first `<<>>`
  block with `$$`. On AMW, join same-span predicates with `and` in one `where`.
- Check parent IDs and timestamps on one example trace per side before claiming a
  direct call or order.
- If ancestry returns zero while parent links exist, run one same-scope
  co-occurrence control. If the control reads data but ancestry reports
  `FilesSkippedBySchemaVersion`, report a storage-schema blocker and stop
  retrying syntax.

## Latency

- Use `monitor traces query analyze-critical-path` with `max-results=1000` on complete, nonempty
  populations of at most 1000 IDs. Inspect actual full rows and metadata;
  there is no query-defined or structured-results mode. If the full cohort
  exceeds the ID limit, do not claim a full-cohort CPA.
- Parallel durations or extra spans alone do not prove an end-to-end slowdown.
