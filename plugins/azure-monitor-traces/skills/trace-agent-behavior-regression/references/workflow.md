# Azure MCP capability boundary

This adapter targets merged Azure MCP Monitor commands, not the original
standalone server. Load `trace-investigation-contract` and its transport/capability
reference before executing a workflow. At an unavailable
required step, report the missing capability and the result that cannot be claimed.
Never approximate that step or invent a tool/parameter. Supported query,
selection-versus-remainder top attributes and ordinary critical path remain usable.

# Agent behavior regression

Before the first trace query, load the plugin skill `trace-investigation-contract`
by its exact native name and reuse it throughout. Follow it for provider, `P`/`Q`,
windows, completeness, budgets, continuation and the answer shape.
This skill adds only GenAI accounting. Read
[details.md](details.md) only for the section a step names.

## GenAI accounting

- **Unit:** observed merged trace or verified agent-invocation subtree. Usage in
  separate traces joined by conversation or session ID is correlated
  composition, not ancestry, path or order.
- **Usage:** sum provider-reported input/output on inference spans only, never
  agent rollups too. `invoke_agent`/`execute_tool` are operations, not inferences.
- **Cache:** project every exposed cache key in both cohorts → *Cache*.
- **Strata:** compare the same agent across cohorts; report mix shift separately.
- **Decomposition:** split a token delta into operations per unit × tokens per
  inference, stating the formula → *Reduction*.
- A differing model or version co-occurs; it is never the "because".

## Steps

Independent current/baseline comparisons are unavailable. Inspect only supplied
paired evidence or explicitly bounded single-cohort observations; do not draw
separate cohorts or run unpaired calls to reconstruct the missing comparison.
Per-unit accounting remains useful in supplied observations, not proof of an
account-wide regression.

1. Schema: find `gen_ai.*` usage, cache, agent, model and tool fields.
2. Start with one batched span projection per cohort with usage and cache
   fields, then do any fragment assembly, recovery or missing fields the shared
   contract requires. Never present incomplete accounting as complete totals. If the projected
   `P` spans carry no usage, one broader search for usage-bearing spans is
   discovery only: it never redefines `P` or attributes out-of-`P` usage to the
   requested agent without verified identity or correlation links. Otherwise
   usage stays unknown.
3. Answer the direct question (tokens/unit, error counts, latency).
4. For a separately requested contained selection-versus-remainder scope, one
   `monitor traces query analyze-top-attributes`, then one supported check of the observed candidate.
   This command cannot replace an independent comparison.
   `~>` for a path delta within trace units → *Structural*. If no path delta
   exists or units are correlation-only across traces, run the discriminating
   check that is supported and report the ancestry gap. Always do this for
   failure/path questions, even with 0 failures. Latency only on comparable
   units → *Latency*.
5. A version, model, deploy or workload-mix difference, or an unknown driver,
   triggers the shared continuation step: run `trace-what-changed` (or
   `trace-latency-root-cause` / `trace-error-blast-radius` for a comparable slowdown or an
   observed error) before answering.

## Table rows

| Per <unit> | Baseline | Comparison |
|---|---:|---:|
| Units; tokens/unit mean (p50/p95) | | |
| Inferences/unit; tokens/inference | | |
| Errors; cache tokens (nonzero spans) | | |

Bottom line states the measured mechanism and ratio, e.g. "1.95× tokens per
run: same 1 inference per run, 1.95× tokens per inference", and the driver as
found or unknown.
