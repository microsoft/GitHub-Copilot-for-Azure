# Two-Phase Evaluator Strategy

Strategy for evaluator selection across initial setup and iterative optimization. Part of the [observe skill](../observe.md).

## Two-Phase Evaluator Strategy

| Phase | When | Evaluators | Dataset fields | Goal |
|-------|------|------------|----------------|------|
| Phase 1 - Initial setup | Before the first eval run | <=5 built-in evaluators only: `relevance`, `task_adherence`, `intent_resolution`, `indirect_attack`, plus `builtin.tool_call_accuracy` when the agent uses tools | `query`, `expected_behavior` (plus optional `context`, `ground_truth`) | Establish a fast baseline and identify which failure patterns built-ins can and cannot explain |
| Phase 2 - After analysis | After reviewing the first run's failures and clusters | Reuse existing custom evaluators first; create a new custom evaluator only when the built-in set cannot capture the gap | Reuse `expected_behavior` as a per-query rubric | Turn broad failure signals into targeted, domain-aware scoring |

Phase 1 keeps the first setup fast and comparable across agents. Even though the initial built-in evaluators do not consume `expected_behavior`, include it in every seed dataset row so the same dataset is ready for Phase 2 custom evaluators without regeneration.

When built-in evaluators reveal patterns they cannot fully capture - for example, false negatives from `task_adherence` missing tool-call context or domain-specific quality gaps - first call `evaluator_catalog_get` again to see whether an existing custom evaluator already covers the dimension. Only create a new evaluator when the catalog still lacks the required signal.

Example custom evaluator for Phase 2:

```yaml
name: behavioral_adherence
promptText: |
  Given the query, response, and expected behavior, rate how well
  the response fulfills the expected behavior (1-5).
  ## Query
  {{query}}
  ## Response
  {{response}}
  ## Expected Behavior
  {{expected_behavior}}
```

> Tip: This evaluator scores against the per-query behavioral rubric in `expected_behavior`, not just the agent's global instructions. That usually produces a cleaner signal when broad built-in judges are directionally correct but too coarse for optimization.

> [!] Output contract: Do not add `Return JSON: {"score": ...}` or any extra output-format block to custom evaluator `promptText`. The evaluator runtime appends and enforces the final JSON contract (`result` and `reason`). If a user-supplied rubric asks for `score`/`reasoning`, normalize that wording to `result`/`reason` or omit the output schema entirely before calling `evaluator_catalog_create`.
