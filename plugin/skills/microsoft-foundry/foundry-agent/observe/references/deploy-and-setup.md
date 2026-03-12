# Step 1 — Auto-Setup Evaluators & Dataset

> **This step runs automatically after deployment.** If the agent was deployed via the [deploy skill](../../deploy/deploy.md), `.foundry` cache and metadata may already be configured. Check `.foundry/evaluators/`, `.foundry/datasets/`, and `.foundry/agent-metadata.yaml` for existing artifacts before re-creating them.
>
> If the agent is **not yet deployed**, follow the [deploy skill](../../deploy/deploy.md) first. It handles project detection, Dockerfile generation, ACR build, agent creation, container startup, and auto-creates `.foundry` cache after a successful deployment.

## Auto-Create Evaluators & Dataset

> **This step is fully automatic.** After deployment, immediately prepare evaluators and a local test dataset for the selected environment without waiting for the user to request it.

### 1. Read Agent Instructions

Use **`agent_get`** (or local `agent.yaml`) to understand the agent's purpose and capabilities.

### 2. Reuse or Refresh Cache

Inspect `.foundry/evaluators/`, `.foundry/datasets/`, and the selected environment's `testCases[]`.

- **Cache is current** -> reuse it and summarize what is already available.
- **Cache is missing or stale** -> refresh it after confirming with the user.
- **User explicitly asks for refresh** -> rebuild and rewrite only the selected environment's cache.

### 3. Select Evaluators

Combine built-in, custom, and safety evaluators:

| Category | Evaluators |
|----------|-----------|
| **Quality (built-in)** | intent_resolution, task_adherence, coherence, fluency, relevance |
| **Safety (include >=2)** | violence, self_harm, hate_unfairness, sexual, indirect_attack |
| **Custom (create 1-2)** | Domain-specific via `evaluator_catalog_create` |

### 4. Create Custom Evaluators

Use **`evaluator_catalog_create`** with the selected environment's project endpoint.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectEndpoint` | ✅ | Azure AI Project endpoint |
| `name` | ✅ | For example, `domain_accuracy`, `citation_quality` |
| `category` | ✅ | `quality`, `safety`, or `agents` |
| `scoringType` | ✅ | `ordinal`, `continuous`, or `boolean` |
| `promptText` | ✅* | Template with `{{query}}`, `{{response}}` placeholders |
| `minScore` / `maxScore` | | Default: 1 / 5 |
| `passThreshold` | | Scores >= this value pass |

### 5. Identify LLM-Judge Deployment

Use **`model_deployment_get`** to list the selected project's actual model deployments, then choose one that supports chat completions for quality evaluators. Do **not** assume `gpt-4o` exists in the project. If no deployment supports chat completions, stop the setup flow and explain that quality evaluators need a compatible judge deployment.

### 6. Generate Local Test Dataset

Use the identified chat-capable deployment to generate realistic test queries based on the agent's instructions and tool capabilities. Save to `.foundry/datasets/<agent-name>-<environment>-test-v1.jsonl` with each line containing at minimum a `query` field (optionally `context`, `ground_truth`).

### 7. Persist Artifacts and Test Cases

```text
.foundry/
  agent-metadata.yaml
  evaluators/
    <name>.yaml
  datasets/
    *.jsonl
  results/
    <environment>/
      <eval-id>/
        <run-id>.json
```

Save evaluator definitions to `.foundry/evaluators/<name>.yaml`, test data to `.foundry/datasets/*.jsonl`, and create or update test cases in `agent-metadata.yaml` with:
- `id`
- `priority` (`P0`, `P1`, `P2`)
- dataset reference
- evaluator names and thresholds

> ⚠️ **Show Data Viewer deeplinks:** Append a Data Viewer deeplink immediately after reference to a dataset file in your response. Format: [Open in Data Viewer](vscode://ms-windows-ai-studio.windows-ai-studio/open_data_viewer?file=<file_path>&source=microsoft-foundry-skill) for details and perform analysis.

### 8. Prompt User

*"Your agent is deployed and running in the selected environment. The `.foundry` cache now contains evaluators, a local test dataset, and test-case metadata. Would you like to run an evaluation to identify optimization opportunities?"*

If yes -> proceed to [Step 2: Evaluate](evaluate-step.md). If no -> stop.
