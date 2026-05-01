# Optimization Candidate Jobs

Use this reference when you want to run `agent_optimization_start` instead of direct `prompt_optimize`.

## Tools

- `agent_optimization_start`, `agent_optimization_get`
- `evaluator_catalog_get`, `evaluator_catalog_create`

## Required Inputs

Do not call `agent_optimization_start` until all four inputs are resolved:

1. `agentName`
2. `projectEndpoint`
3. dataset input
4. `evaluators`

## Input 1 — Agent Name

1. Read `agent.manifest.yaml` first.
2. In Foundry samples, the agent name is the top-level `name` field. Use that value as `agentName`.
3. If the manifest has only `displayName`, treat that as a label, not the deployed `agentName`. Ask the user to confirm the actual agent name instead of assuming `displayName` is correct.
4. If `agent.manifest.yaml` is missing or the top-level `name` field is missing, ask the user for the agent name.
5. Restate the resolved agent name before continuing.

Example pattern from Foundry samples:

```yaml
name: toolbox-azd-web-search
displayName: "LangGraph Web Search Toolbox Agent"
```

Interpretation:

- use `name` for `agentName`
- do not use `displayName` as the optimization target unless the user explicitly confirms it

## Input 2 — Project Endpoint

1. If a project endpoint is already present in the current context, reuse it.
2. Otherwise, ask the user for the Azure AI Project endpoint.
3. Do not infer or invent the endpoint.
4. Restate the resolved endpoint before continuing.

## Input 3 — Dataset

The optimization job must use exactly one dataset mode:

- `datasetJson`, or
- `trainDatasetName` + `trainDatasetVersion`

### Use existing dataset

If the user already has a dataset, confirm whether to use:

- a local `.foundry/datasets/` file, or
- a registered Foundry dataset (`trainDatasetName` + `trainDatasetVersion`)

### Create new dataset

If the user wants a new dataset, route through the eval-datasets skill first:

- [Generate Seed Dataset](../../eval-datasets/references/generate-seed-dataset.md)
- [Trace-to-Dataset Pipeline](../../eval-datasets/references/trace-to-dataset.md)

After dataset creation, convert the result into the optimization input shape if using `datasetJson`:

```json
[
  {
    "query": "What is 12 + 7?",
    "name": "math-basic-add",
    "groundTruth": "19"
  }
]
```

Rules:

- `query` is required
- `name` is optional
- `groundTruth` is optional
- show the final dataset input to the user before continuing

## Input 4 — Evaluators

1. Call `evaluator_catalog_get` using the resolved `projectEndpoint`.
2. Show the user the available evaluators grouped as built-in and custom.
3. Ask the user which evaluators they want to use.
4. If the user wants a new custom evaluator, call `evaluator_catalog_create`, then show the created evaluator and ask for confirmation.
5. Do not silently choose default evaluators.

Mandatory question:

> "Which evaluators do you want for this optimization run? You can choose from existing built-in evaluators, existing custom evaluators, or ask me to create a new custom evaluator."

## Invocation Flow

1. Resolve `agentName` from `agent.manifest.yaml`; otherwise ask the user.
2. Resolve `projectEndpoint` from current context; otherwise ask the user.
3. Resolve dataset input by reusing an existing dataset or creating a new one through eval-datasets.
4. Call `evaluator_catalog_get` and show built-in and custom evaluators.
5. Ask the user to choose evaluators.
6. If needed, create a custom evaluator with `evaluator_catalog_create`.
7. Restate all final inputs: `agentName`, `projectEndpoint`, dataset mode, and evaluator list.
8. Only then call `agent_optimization_start`.

## Guardrails

- Never call `agent_optimization_start` before all four inputs are resolved.
- Never proceed without asking the user about evaluators.
- Never auto-apply optimization outputs.
- Treat optimization candidates as suggestions only.

## Error Handling

|Error|Likely Cause|Resolution|
|---|---|---|
|`projectEndpoint is required`|Missing project endpoint|Ask the user for the endpoint and retry|
|`Either datasetJson or trainDatasetName+trainDatasetVersion must be provided`|Missing dataset input|Resolve one dataset mode before calling the tool|
|`trainDatasetVersion is required`|Dataset name given without version|Add `trainDatasetVersion`|
|`evaluators must not be empty`|Evaluator list missing|Call `evaluator_catalog_get`, ask the user to choose evaluators, then retry|
|`Failed to parse datasetJson`|Invalid dataset JSON|Validate the JSON array and ensure each row has `query`|
