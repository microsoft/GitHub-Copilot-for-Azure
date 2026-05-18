# Evaluation Suite Generation

Use generated suites as the preferred setup path for deployed agents. The suite generation job can create synthetic or trace-derived data plus an adaptive evaluator from agent, dataset, file, prompt, or trace context.

## Step 1: Ask the User Which Source to Use (MANDATORY)

> ⚠️ **Do not call `evaluation_suite_generation_job_create` without asking the user first.** The generation source materially changes the suite's coverage and cost. Use `ask_user` / `askQuestions` with these two options:
>
> - **(a) Current agent code/definition** — synthetic Q&A generated from the agent's instructions and tool definitions. Best for brand-new or recently changed agents with no production traffic.
> - **(b) Historical traces** — sampled from real conversations. **Default lookback: last 3 days (`maxTraces` ~50).** Best for deployed agents with traffic, since the suite reflects real user intents and edge cases.
>
> **Default selection rule:** If the agent has traces in the last 3 days (check via `trace` skill or `evaluation_agent_traces_batch_eval_create` lookback probe), recommend (b); otherwise recommend (a). Always let the user override.

If the user picks (b), compute `traceStartTime` and `traceEndTime` as unix seconds for the chosen window (default `now - 3*86400` to `now`).

## Step 2: Create and Poll

Call `evaluation_suite_generation_job_create` with the selected `projectEndpoint`, `suiteName`, and `generationModelDeploymentName`. Provide the best available source context:

| Source | Parameters |
|--------|------------|
| Deployed agent (code/definition) | `agentName`, **`agentSourceNames: [<agentName>]`** (required for target), `agentSourceDescription` |
| Existing dataset | `datasetName`, `datasetVersion`, `datasetSourceDescription` |
| File | `fileId`, `fileSourceDescription` |
| Prompt | `promptSource`, `promptSourceDescription` |
| Traces | `traceAgentName` or `traceAgentId`, `traceAgentVersion`, `traceStartTime`, `traceEndTime` (unix seconds), `maxTraces`, `tracesSourceDescription` |

Set `dataGenerationType` (default `simple_qna`), `category` (default `quality`), `deploymentName` (target model for the evaluator's judge — required for LLM-judge evaluators), and `maxSamples` for generated examples.

### Parameter Requirements (Learned Constraints)

> ⚠️ The service rejects requests that miss these:
> - **`maxSamples` must be between 15 and 1000.** Smaller values (e.g., 10) fail with `Max samples must be between 15 and 1000`. Default to `15` for quick smoke suites, `50–100` for richer baselines.
> - **A `target` is required.** When generating from a deployed agent, pass **`agentSourceNames: [<agentName>]`** (not just `agentName`) so the service can construct the `azure_ai_agent` target. Without it, the request fails with `Target is required for evaluation suite generation`.
> - **`deploymentName`** (in `initialization_parameters`) is required when the generated evaluator uses an LLM judge — pass the same or a comparable deployment as `generationModelDeploymentName`.

Poll with `evaluation_suite_generation_job_get(projectEndpoint, jobId)` until the job reaches a terminal state (`succeeded`, `failed`, `canceled`). Generation typically takes **5–15 minutes** for synthetic Q&A and longer for trace-derived suites — poll at 60–120 second intervals; do not assume completion before the first poll. After success, call `evaluation_suite_get(projectEndpoint, suiteName, version)` to inspect the generated suite.

> 🛑 **MANDATORY: Poll to a terminal state in the same turn — do not hand control back to the user mid-poll.** Once you have called `evaluation_suite_generation_job_create`, you MUST keep calling the `evaluation_suite_generation_job_get` MCP tool until `status` is `succeeded`, `failed`, or `canceled`. Returning a final summary to the user with `status: in_progress` (or asking the user to "ask again later") is a workflow violation.
>
> **How to poll:** Just call the `evaluation_suite_generation_job_get` MCP tool directly, back-to-back, in the same turn. Each MCP call takes long enough on its own that no `Start-Sleep` is needed between calls; the global no-sleep rule still applies to the main agent. Synthetic Q&A jobs typically reach a terminal state within 5–15 minutes, so expect on the order of 5–15 polls. If you have other useful workflow steps (RBAC checks, dataset cache prep, evaluator catalog inspection), you may interleave them between polls, but **do not stop polling** until the job is terminal.
>
> The only situations where you may stop before terminal state are: (a) the user explicitly tells you to stop polling, (b) the job has been `in_progress` for >30 minutes (treat as stuck — surface the job ID and ask the user how to proceed), or (c) the poll itself errors repeatedly (surface the error). In all three cases, leave the in-flight `generationJobId` recorded in `.foundry/agent-metadata.yaml` so a later turn can resume polling with `evaluation_suite_generation_job_get`.
>
> When the job reaches `succeeded`, immediately continue with `evaluation_suite_get` and the cache/metadata steps below before producing your final summary.

## Cache Artifacts Locally

Save generated or fetched references under the selected agent root only:

```text
.foundry/datasets/<agent-name>-<suite-name>-<version>.jsonl
.foundry/evaluators/<evaluator-name>-<version>.yaml
```

If job output includes direct file/session references, download those artifacts. If it only returns remote suite, dataset, and evaluator names/versions, call `evaluation_suite_get`, `evaluation_dataset_get`, and `evaluator_catalog_get` and create local reference files from the returned metadata or dataset URI. Ask before overwriting existing cache files.

## Regenerate One Artifact

Use `data_generation_job_create` when the user wants fresh data without replacing the whole suite. It accepts `jobName`, `projectEndpoint`, optional `agentName`/`agentVersion`, `datasetName`/`datasetVersion`, `fileId`, `promptSource`, trace parameters, `generationType`, `questionTypes`, `scenario`, `maxSamples`, and `trainSplit`. Poll with `data_generation_job_get`.

Use `evaluator_generation_job_create` to create or regenerate one adaptive evaluator. To regenerate, pass the existing `evaluatorName` plus updated source inputs and `modelDeploymentName`; poll with `evaluator_generation_job_get`.

## Review and Sync Back

After users edit generated dataset rows or evaluator rubrics locally:

1. Save a new local dataset/evaluator version instead of overwriting the old one.
2. Register approved dataset data with `evaluation_dataset_create`.
3. For evaluator rubric changes, use `evaluator_catalog_update(createNewVersion: true)` when metadata/dimension edits are sufficient; otherwise regenerate with `evaluator_generation_job_create(evaluatorName, ...)`.
4. Create an immutable suite version with `evaluation_suite_create` so future `evaluation_suite_run` calls use the reviewed artifacts.

## Fallback

If suite, data, or evaluator generation fails or returns incomplete artifacts, explain the failure and use the manual fallback: `evaluator_catalog_get`, local seed JSONL generation, `evaluation_dataset_create`, and `evaluationSuites[]` metadata with `generationSource: manual-fallback`.
