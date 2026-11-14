# Step 1 - Auto-Setup Evaluation Suite

> **Local approval override:** [Execution boundaries](../../../references/execution-boundaries.md)
> supersede the retained "automatic" and "immediately" instructions below.
> This entire setup path is optional, outside evidence-only investigation.
> No job creation, data registration, downloads, cache/metadata writes, CLI
> scripts or fallback generation without a separately scoped task and explicit
> operation/input/privacy/cost/persistence approval. Never run on load or after
> a deployment by default. No background polling; status reads need a finite
> budget. Missing cache is not permission to create it.

This step does **not** run automatically after deployment. Existing approved
context/artifacts may be reused; setup is a separate task, not an investigation
prerequisite. The [deploy skill](../../deploy/deploy.md) is not implicitly invoked.

## Auto-Generate Suite

Only after explicit selection and applicable approvals, use the retained
procedure below to prepare a suite. Never silently generate or persist artifacts.

### 1. Resolve Context

Use [Common Project Context Resolution](../../../SKILL.md#agent-common-project-context-resolution) to compute effective context. In azd projects, prefer `azd env get-values` for deployment context and use the selected `.foundry/agent-metadata*.yaml` file only as an overlay/cache. Use `agent_get`, the local `azure.yaml` service block, and matching `eval.yaml` as needed to resolve:

| Value | Source |
|-------|--------|
| `projectEndpoint` | azd env, then metadata override |
| `agentName` / `agentVersion` | azd agent vars, then metadata/`agent_get` |
| `suiteName` | verified `eval.yaml` name or `<agent-name>-smoke` unless user provided one |
| generation deployment | `model_deployment_get`; choose a chat-completions deployment |

`suiteName` must start with a letter (`A-Z` or `a-z`). If a derived name starts with a number, prefix it with an alphabetic label such as `suite-`.

Do not assume `gpt-4o` exists.

### 2. Reuse or Refresh Cache

Inspect `.foundry/suites/`, `.foundry/evaluators/`, `.foundry/datasets/`, matching `eval.yaml`, and the selected environment's `evaluationSuites[]` in the selected agent root only. Do **not** merge sibling agent folders.

- **Suite metadata has `suiteName` and current cache** -> call `evaluation_suite_get` to verify the remote suite, then reuse it.
- **`eval.yaml` exists and matches the selected agent** -> verify its `dataset.local_uri` or registered `dataset.name`/`dataset.version`, `evaluators[]`, and optional `name` remotely or register them before persisting a synced suite entry. Normalize legacy `dataset_file` in memory only.
- **Cache is missing/stale or user asks refresh** -> generate a new suite after confirming any overwrite.
- **Legacy entry without `suiteName`** -> keep it as legacy fallback metadata unless the user approves generating a new suite.

### 3. Generate Suite

Read [Evaluation Suite Generation](evaluation-suite-generation.md). If the user selected existing `eval.yaml`, follow the local eval.yaml verification/registration path there before creating a generated suite. Otherwise call:

```text
evaluation_suite_generation_job_create(
  projectEndpoint,
  suiteName,
  agentName,
  generationModelDeploymentName,
  dataGenerationType,
  maxSamples
)
```

For trace-informed suites, include `traceAgentName` or `traceAgentId`, `traceAgentVersion`, `traceStartTime`, `traceEndTime`, and `maxTraces`. Start background polling with `evaluation_suite_generation_job_get`, suppress intermediate `in_progress` output, then verify the generated suite with `evaluation_suite_get` after terminal success.

When refining an existing dataset, include `datasetName` and `datasetVersion`.

### 4. Persist Local References

Cache generated artifacts inside the selected root:

```text
.foundry/
  agent-metadata.yaml
  agent-metadata.prod.yaml
  suites/<suite-name>-v<version>.json
  evaluators/<evaluator-name>-v<version>.json
  datasets/<agent-name>-<dataset-name>-v<version>.ref.json
  datasets/<dataset-name>-v<version>/<blob-name>
  results/
```

If the job result exposes only remote names/versions, fetch metadata with `evaluation_suite_get(projectEndpoint, suiteName, suiteVersion)`, `evaluation_dataset_get`, `evaluation_dataset_sas_url_get`, and `evaluator_catalog_get`, then materialize the full suite JSON, full evaluator JSON, dataset `.ref.json`, and downloaded dataset blobs. Never overwrite user-edited cache files without confirmation; deterministic re-fetch of the same immutable remote `<name>-v<version>` may replace the generated cache artifact for that exact version.

### 5. Update Metadata

Write only the selected metadata file and selected environment. In azd projects, persist only non-derivable overlay/cache state; do not copy azd-owned project endpoint, agent name/version, ACR, or observability values. Persist evaluation suites with:

- `id`, `tags`, `suiteName`, `suiteVersion`
- `generationJobId`, `generationSource` (`synthetic`, `traces`, or `manual-fallback`)
- `dataset`, `datasetVersion`, `datasetFile`, `datasetUri`
- evaluator `name`, `version`, `threshold`, `definitionFile` (full cached JSON)

Use tags such as `tier: smoke`, `purpose: baseline`, and `stage: generated`. If metadata still uses older `testSuites[]` or legacy `testCases[]`, replace that list with `evaluationSuites[]` on write and map `priority` to `tags.tier` only when `tags.tier` is missing.

### 6. Fallback

If suite generation fails, is unavailable, or returns incomplete artifacts, explain the failure and fall back to the existing manual path: `evaluator_catalog_get`, local seed JSONL generation via [Generate Seed Evaluation Dataset](../../eval-datasets/references/generate-seed-dataset.md), `evaluation_dataset_create`, and `evaluationSuites[]` metadata with `generationSource: manual-fallback`.

### 7. Prompt User

Ask: *"Your agent is deployed and the selected environment has evaluation-suite metadata plus local dataset/evaluator references. Would you like to run an evaluation to identify optimization opportunities?"*

If yes -> proceed to [Step 2: Evaluate](evaluate-step.md). If no -> stop.
