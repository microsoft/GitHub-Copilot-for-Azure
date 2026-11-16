# Selected guidance: Step 5: Resolve Common Configuration; Step 6: Write Metadata Overlay (Create/Deploy/Observe Only); Step 7: Collect Missing Values

> Reading grants no execution approval. Apply the entry's current-request
> intent and standalone availability gates. Analyze supplied evidence in
> memory: no Azure, Python, installs, auth, cache, writes or jobs required.
> Live reads require approved scope/window, verified operations/schemas and
> finite budgets; missing/denied/empty/partial evidence stays distinct and
> insufficient evidence is INCONCLUSIVE. Lifecycle actions, sensitive content,
> traffic, persistence, edits and deployment need separate explicit approval.
> These rules supersede conflicting automatic actions in retained examples.

[Execution boundaries](../references/execution-boundaries.md) apply; load only the boundary
section needed by the selected action, never every linked reference.

- `dataset.name` / `dataset.version` -> registered dataset candidate.
- `validation_dataset` -> optional validation dataset candidate.
- `evaluators[]` -> candidate Foundry evaluator names; verify with `evaluator_catalog_get` before treating them as remote evaluators.
- `name` -> local eval/suite candidate; verify remotely before persisting as `suiteName`.
- `options.eval_model`, `options.optimization_model`, `options.max_candidates`, `options.optimization_config.model_search_space`, `options.pass_threshold`, `max_samples`, `trace_days`, and `generation_instruction` -> setup defaults.

Treat `eval.yaml` as local evaluation intent, not proof that a Foundry suite exists. Persist synced suite/dataset/evaluator references to `.foundry` only after remote lookup or registration succeeds.

### Step 5: Resolve Common Configuration

Layer sources in this order:

1. Explicit user input and values already selected in the session
2. azd environment values for deployment context
3. `.foundry/agent-metadata*.yaml` overlay values and remote suite/cache references
4. `azure.yaml` and `eval.yaml` local source configuration
5. User prompts for anything still missing

If azd and metadata both provide the same value and they differ, stop and ask which source is authoritative. If they match, use the azd value and avoid rewriting the duplicate on future metadata writes.

| Effective Value | Preferred Source | Used By |
|-----------------|------------------|---------|
| Project endpoint | azd env | deploy, invoke, observe, trace, troubleshoot |
| Agent name/version | azd agent variables, then `azure.yaml` | invoke, observe, trace, troubleshoot |
| ACR | azd env | deploy |
| Evaluation suites and cache paths | `.foundry/agent-metadata*.yaml` | observe, eval-datasets |
| Local seed dataset/evaluator intent | `eval.yaml` | observe, eval-datasets |

### Step 6: Write Metadata Overlay (Create/Deploy/Observe Only)

On any metadata write (deploy, auto-setup, dataset refresh, or trace-to-dataset update), persist only non-derivable overlay/cache state in the selected metadata file:

- azd binding (`azd.environmentName`, `azd.service`) when useful for future resolution
- `evaluationSuites[]` with remote suite/dataset/evaluator references and local cache paths
- `lastEval`, result files, comparison summaries, or explicit non-azd overrides

Do not copy azd-owned deployment values into metadata when azd already provides them. If the selected file is a preferred single-environment file, rewrite only that one environment block. If the selected file is a legacy multi-environment file, rewrite only the selected environment block. Never copy or merge environments across sibling metadata files automatically. If the selected environment still uses older `testSuites[]` or legacy `testCases[]`, rewrite it to `evaluationSuites[]` and remove migrated `priority` fields from the rewritten entries.

### Step 7: Collect Missing Values

