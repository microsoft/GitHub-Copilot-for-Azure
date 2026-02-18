---
name: agent-framework
description: |
  Evaluate AI agents and workflows built with Microsoft Agent Framework using pytest-agent-evals plugin. Supports built-in and custom evaluators with VS Code Test Explorer integration.
  USE FOR: evaluate agent, test agent, assess agent, agent evaluation, pytest evaluation, measure agent performance, agent quality, add evaluator, evaluation dataset, judge model.
  DO NOT USE FOR: creating agents (use agent/create), deploying agents (use agent/deploy), evaluating non-Agent-Framework agents.
---

# Evaluate Agent with pytest-agent-evals

Assess agent performance using the `pytest-agent-evals` plugin — a pytest-based evaluation framework integrated with VS Code Test Explorer and AI Toolkit.

> **Prerequisite**: The agent under test MUST be built with Microsoft Agent Framework (`agent_framework.ChatAgent` or `agent_framework.WorkflowAgent`). If not, inform user and skip evaluation.

## Quick Reference

| Property | Value |
|----------|-------|
| **Plugin** | pytest-agent-evals (>=0.0.1b260210) |
| **Framework** | pytest |
| **Agent SDK** | Microsoft Agent Framework (ChatAgent, WorkflowAgent) |
| **Integration** | VS Code Test Explorer, AI Toolkit |
| **Best For** | Systematic agent evaluation with built-in and custom evaluators |

## When to Use This Skill

Use when the user wants to:

- **Evaluate** or test an existing agent's performance
- **Set up** systematic evaluation with metrics
- **Add** built-in or custom evaluators
- **Generate** evaluation test dataset
- **Configure** judge model for prompt-based evaluation

## Defaults

- **Plugin**: pytest-agent-evals (pin version `>=0.0.1b260210`)
- **Environment**: Reuse agent's existing virtual environment

## MCP Tools

This skill delegates to `microsoft-foundry` MCP tools for model and project operations:

| Tool | Purpose |
|------|---------|
| `foundry_models_list` | Browse model catalog for judge model selection |
| `foundry_models_deployments_list` | List deployed models for judge model |
| `foundry_resource_get` | Get project endpoint |

## References

| Topic | File | Description |
|-------|------|-------------|
| Code Example | [references/code-example.md](references/code-example.md) | Complete evaluation code example, key concepts, code generation guidelines |
| Built-in Evaluators | [references/built-in-evaluators.md](references/built-in-evaluators.md) | Agent, general purpose, RAG, and similarity evaluators catalog |
| Custom Evaluators | [references/custom-evaluators.md](references/custom-evaluators.md) | Custom prompt (LLM judge) and code (Python function) evaluators |

## Evaluation Workflow

```markdown
Evaluation Setup:
- [ ] Clarify evaluation metrics
- [ ] Obtain test dataset (file or generate)
- [ ] Resolve judge model (if needed)
- [ ] Generate evaluation code
- [ ] Set up project configuration
- [ ] Install dependencies
- [ ] Verify & Handoff
```

### Step 1: Clarify Metrics

Analyze user's app and suggest 1-3 relevant metrics. Metrics can be **built-in** (see [references/built-in-evaluators.md](references/built-in-evaluators.md)) or **custom**. Always state the metric type.

```
Based on your [agent type], I recommend:
1. [Metric name] — [brief description] (built-in | custom, prompt-based | code-based)
2. [Metric name] — [brief description] (built-in | custom, prompt-based | code-based)

Should I proceed with these metrics?
```

**Example** — math solver agent, general request "set up evaluation":
```
1. correctness — validates if the agent answer matches the ground truth (custom, code-based)
2. tool_call_accuracy — assesses tool usage relevance and parameter correctness (built-in, prompt-based)
```

**Guidelines:**
- If user specifies objectives (e.g., "evaluate tool accuracy") → suggest only relevant metrics
- If general request ("evaluate my agent") → suggest max 3 most important
- Match metric count to explicitly mentioned objectives
- Prefer built-in evaluators when they fit; use custom when no built-in covers the need

### Step 2: Obtain Test Dataset

```
How would you like to provide test queries?
1. Point to existing JSONL file
2. Let me generate sample queries
```

**Dataset format** — JSONL with required `query` field and optional `id`:
```jsonl
{"id": "weather_ny", "query": "What's the weather in New York?"}
{"id": "time_utc", "query": "What's the current UTC time?"}
```

If generating, create 5-10 realistic queries and save to `<agent_name>_dataset.jsonl`.

### Step 3: Resolve Judge Model (if needed)

A judge model is only required when the selected metrics include **prompt-based** evaluators (see Type column in [Built-in Evaluators](#built-in-evaluators)) or Custom Prompt Evaluators. If all metrics are code-based or Custom Code Evaluators only, skip this step.

**Default (silent)**: Use the agent's own Foundry model deployment (`FOUNDRY_MODEL_DEPLOYMENT_NAME`). Do NOT ask the user.

**Unsupported models** — cannot produce structured evaluation output:
- **Reasoning models**: DeepSeek R-series, OpenAI o-series (e.g., `o1`, `o3`, `o4-mini`)
- **OpenAI gpt-5 series** (excluding `gpt-5-chat` variants which ARE supported)

**If the agent's model is unsupported**: Use `microsoft-foundry` skill's model catalog to help the user select and deploy a suitable judge model.

### Step 4: Confirm and Generate

```
Evaluation Plan:
- Metrics: [list]
- Dataset: [source]
- Agent: [agent fixture/file]
- Judge Model: [deployment name] (auto-selected / user-selected)

Proceed to generate evaluation code?
```

### Step 5: Generate Evaluation Code

Use the `pytest-agent-evals` plugin to write test-suite-style evaluation code. See [references/code-example.md](references/code-example.md) for the complete example, key concepts, and code generation guidelines. If the selected metrics include custom evaluators, see [references/custom-evaluators.md](references/custom-evaluators.md) for prompt-based and code-based patterns.

### Step 6: Set Up Project

#### Install Dependencies

```bash
pip install pytest-agent-evals>=0.0.1b260210 --pre
```

#### .vscode/settings.json

Create or update `.vscode/settings.json` to enable VS Code Test Explorer integration:

```jsonc
{
    "python.testing.pytestArgs": [
        ".",
        "--cache-mode=session"
    ],
    "python.testing.pytestEnabled": true
}
```

> `--cache-mode=session` clears response cache at startup for consistency. Use `--cache-mode=persistence` to preserve cache across sessions for rapid evaluator tuning.

#### Verify

If the required model environment variables are not yet configured (e.g., `.env` values are empty or placeholders), skip verification and inform the user to set the environment variables before running tests.

Run **all evaluators with a single test case** to verify the setup and all evaluators work well without waiting for the full dataset:

```bash
pytest test_<agent_name>.py -k "<first_test_case_id>" -v
```

For example, if the test class is `TestWeatherAgent` and the first dataset entry has id `weather_ny`:
```bash
pytest test_weather_agent.py -k "weather_ny" -v
```

After the test runs successfully, the plugin saves results to `test-results/evaluation_results_<timestamp>.json`. The result file schema:

```json
{
  "rows": [
    {
      "inputs.query": "user query",
      "outputs.response": "agent response",
      "outputs.tool_calls": "tool calls made by agent",
      "outputs.tool_definitions": "tool definitions available to agent",
      "outputs.<evaluator_name>.score": 5,
      "outputs.<evaluator_name>.reason": "explanation of score",
      "outputs.<evaluator_name>.result": "pass"
    }
  ]
}
```

Each row is a test case result containing the query, agent response, and all evaluators' scores/reasons/results. Read the latest result file, analyze it briefly, and report to the user:
- Whether the test passed or failed
- The evaluator score and reason (if available)
- Any issues to address

If the test fails due to code/setup errors, fix and rerun.

> For the full evaluation, the user can run `pytest test_<agent_name>.py -v` or use VS Code Test Explorer (recommended) — tests appear in the sidebar and results integrate with AI Toolkit.

### Step 7: Generate Evaluation Documentation

Create a `evaluation.md` in the project root with the following sections:

**Setup**: Environment variables needed in `.env` (with placeholder values), install command (`pip install pytest-agent-evals>=0.0.1b260210 --pre`), VS Code settings for Test Explorer.

**Run Evaluations**: VS Code Test Explorer (recommended) — Open Testing panel (flask icon) → click ▶️ to run all or individual tests. Terminal — `pytest test_<agent_name>.py -v`.

**View Results**: Results saved to `test-results/evaluation_results_<timestamp>.json` after each run. Open in **AI Toolkit** panel → **Local Evaluation Results** to browse.

**Update Test Dataset**: Open JSONL dataset file → click **"Generate Test Cases with Copilot"** CodeLens.

**Update Custom Evaluators**: Click **"+ Add Custom Evaluator with Copilot"** CodeLens above test class, or **"Update Custom Evaluator with Copilot"** above a test method.

After generating the documentation, inform the user they can follow `evaluation.md` to run full evaluations, update the test dataset, and add or update custom evaluators.

## Built-in Evaluators

See [references/built-in-evaluators.md](references/built-in-evaluators.md) for the full catalog of agent, general purpose, RAG, and similarity evaluators.

## Custom Evaluators

See [references/custom-evaluators.md](references/custom-evaluators.md) for custom prompt (LLM judge) and code (Python function) evaluator patterns.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent not Agent Framework | Wrong SDK | Inform user; evaluation requires Agent Framework |
| Judge model unsupported | Reasoning/non-chat model | Use `microsoft-foundry` skill to select a supported model |
| Missing env vars | `.env` not configured | Set `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL_DEPLOYMENT_NAME`, `AZURE_OPENAI_ENDPOINT` |
| pytest not found | Plugin not installed | `pip install pytest-agent-evals>=0.0.1b260210 --pre` |
| Import error | Agent not importable | Refactor agent creation into importable function |
