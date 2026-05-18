# Step 2 - Run Evaluation

## Prerequisites

- Agent deployed and running in the selected environment
- Selected `.foundry/agent-metadata*.yaml` file loaded for the active agent root
- Evaluation suite selected from the environment's `evaluationSuites[]`
- For generated suites: `suiteName` present and verified with `evaluation_suite_get`
- For legacy suites: local dataset and evaluator metadata available in `.foundry/`

## Preferred - Run Generated Suite

When the selected suite has `suiteName`, use **`evaluation_suite_run`**.

| Parameter | Description |
|-----------|-------------|
| `projectEndpoint` | Azure AI Project endpoint from the selected metadata file |
| `suiteName` | Foundry evaluation suite name from `evaluationSuites[].suiteName` |
| `version` | Suite version from `evaluationSuites[].suiteVersion`; omit only when latest is intentionally selected |
| `evaluationName` | Include environment and evaluation-suite ID |
| `evaluationLevel` | Required only for conversation datasets (`conversation` or `turn`) |

Before the run, call `evaluation_suite_get(projectEndpoint, suiteName, version)` and confirm the returned suite references the expected dataset/evaluators. Run suites tagged `tier=smoke` first unless the user chooses a broader suite tag or a specific suite.

## Legacy Fallback - Batch Eval

Use **`evaluation_agent_batch_eval_create`** only when the selected metadata entry has no `suiteName` or the generated suite is unavailable and the user accepts fallback execution.

| Parameter | Description |
|-----------|-------------|
| `projectEndpoint` | Azure AI Project endpoint from the selected metadata file |
| `agentName` | Agent name for the selected environment |
| `agentVersion` | Agent version (string, for example `"1"`) |
| `evaluatorNames` | Array of evaluator names from the selected legacy suite |

Read JSONL from `.foundry/datasets/` and pass via `inputData` when the referenced cache file exists. Rows should include `query` and `expected_behavior` when manually generated. Do not set `generateSyntheticData=true` unless the local cache is missing and the user explicitly requests a refresh-free synthetic run.

Before setting `deploymentName`, use `model_deployment_get` to list actual project deployments and choose one that supports chat completions; do **not** assume `gpt-4o` exists.

## Parameter Naming Guardrail

| Tool | Correct Group Parameter | Notes |
|------|-------------------------|-------|
| `evaluation_suite_run` | `suiteName`, `version` | Preferred generated-suite path |
| `evaluation_agent_batch_eval_create` | `evaluationId` | Legacy run grouping only |
| `evaluation_get` | `evalId` | Use with `isRequestForRuns=true` to list runs in one group |
| `evaluation_comparison_create` | `insightRequest.request.evalId` | Comparison requests take `evalId`, not `evaluationId` |

`evaluation_get` does **not** accept `evaluationId`; switch to `evalId` after run creation.

> ⚠️ **Eval-group immutability:** Reuse an existing eval group only when dataset, evaluator list, and thresholds are unchanged. If evaluator definitions or thresholds change, create a new evaluation group or suite version.

## Auto-Poll for Completion

Immediately after creating the run, poll `evaluation_get` in a background terminal until completion. Use `evalId + isRequestForRuns=true` for run lists. The run ID parameter is `evalRunId` (not `runId`).

Only surface the final result when status reaches `completed`, `failed`, or `cancelled`.

## Next Steps

When evaluation completes -> proceed to [Step 3: Analyze Results](analyze-results.md).

## Reference

- [Azure AI Foundry Cloud Evaluation](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/cloud-evaluation)
- [Built-in Evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/built-in-evaluators)
