# Continuous Evaluation

Enable, configure, disable, or remove continuous evaluation for a Foundry agent. Continuous evaluation automatically assesses agent responses on an ongoing basis using configured evaluators (e.g., groundedness, coherence, violence detection). This is typically the final step after deploying and batch-evaluating an agent — it enables ongoing production monitoring.

## When to Use This Skill

USE FOR: enable continuous evaluation, disable continuous evaluation, configure continuous eval, set up monitoring evaluators, check continuous eval status, delete continuous eval, update evaluators, change sampling rate, change eval interval.

DO NOT USE FOR: running a one-off batch evaluation (use [observe](../observe/observe.md)), querying traces (use [trace](../trace/trace.md)), creating evaluator definitions (use [observe](../observe/observe.md) Step 1).

## Quick Reference

| Property | Value |
|----------|-------|
| MCP server | `azure` |
| Key MCP tools | `continuous_eval_create`, `continuous_eval_get`, `continuous_eval_delete`, `agent_get` |
| Prerequisite | Agent must exist in the project |
| Local cache | `.foundry/agent-metadata.yaml` |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Enable continuous eval" / "Set up monitoring evaluators" | [Before Starting](#before-starting--detect-current-state) → [Enable or Update](#enable-or-update) |
| "Is continuous eval running?" / "Check eval status" | [Before Starting](#before-starting--detect-current-state) → [Check Current State](#check-current-state) |
| "Change evaluators" / "Update sampling rate" | [Before Starting](#before-starting--detect-current-state) → [Check Current State](#check-current-state) → [Enable or Update](#enable-or-update) |
| "Pause evaluations" / "Disable continuous eval" | [Before Starting](#before-starting--detect-current-state) → [Disable](#disable) |
| "Stop evaluating this agent" / "Delete continuous eval" | [Before Starting](#before-starting--detect-current-state) → [Delete](#delete) |

> ⚠️ **Important:** Always run [Before Starting](#before-starting--detect-current-state) to resolve the project endpoint and agent name before calling any MCP tools.

## Before Starting — Detect Current State

1. Resolve the target agent root and environment from `.foundry/agent-metadata.yaml` using the [Project Context Resolution](../../SKILL.md#agent-project-context-resolution) workflow.
2. Extract `projectEndpoint` and `agentName` from the selected environment. If not available in metadata, use `ask_user` to collect them.
3. Use `agent_get` to verify the agent exists and note its kind (prompt, workflow, hosted).
4. Use `continuous_eval_get` to check for existing continuous evaluation configuration.
5. Jump to the appropriate entry point based on user intent.

## How It Works

The tool auto-detects the agent's kind and uses the appropriate backend:

- **Prompt and workflow agents** — evaluation runs are triggered automatically each time the agent produces a response. Parameters: `samplingRate` (percentage of responses to evaluate), `maxHourlyRuns`.
- **Hosted agents** — evaluation runs are triggered on an hourly schedule, pulling recent traces from App Insights. Parameters: `intervalHours` (hours between runs), `maxTraces` (max data points per run).

The user does not need to choose between these — the tool handles it based on agent kind.

## Behavioral Rules

1. **Always resolve context first.** Run [Before Starting](#before-starting--detect-current-state) before calling any MCP tool. Never assume a project endpoint or agent name.
2. **Check before creating.** Always call `continuous_eval_get` before `continuous_eval_create` to determine whether to create or update. Present existing configuration to the user.
3. **Confirm evaluator selection.** Present the evaluator list to the user before enabling. Distinguish quality evaluators (require `deploymentName`) from safety evaluators (do not).
4. **Prompt for next steps.** After each operation, present options. Never assume the path forward (e.g., after enabling, offer to check status or adjust parameters).
5. **Keep context visible.** Include the project endpoint, agent name, and environment in operation summaries.
6. **Use `continuous_eval_get` for IDs.** The `delete` tool requires a `configId` — always retrieve it from the `get` response rather than asking the user to provide it.

## Operations

### Check Current State

Before enabling or modifying, check what's already configured:

```
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
```

- Empty list → no continuous eval configured. Proceed to [Enable or Update](#enable-or-update).
- Non-empty list → agent already has continuous eval. Present the configuration and ask what the user wants to change.

### Enable or Update

```
Tool: continuous_eval_create
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
  evaluatorNames: ["groundedness", "coherence", "fluency"]
  deploymentName: "gpt-4o"          # Required for quality evaluators
  enabled: true                      # Set false to disable without deleting
```

If continuous eval already exists, `continuous_eval_create` updates the existing configuration in place.

**Evaluator selection guidance:**
- **Quality evaluators** (require `deploymentName`): coherence, fluency, relevance, groundedness, intent_resolution, task_adherence, tool_call_accuracy
- **Safety evaluators** (no `deploymentName` needed): violence, sexual, self_harm, hate_unfairness, indirect_attack, code_vulnerability, protected_material
- Custom evaluators from the project's evaluator catalog are also supported by name.

**Optional parameters by agent kind:**

| Parameter | Applies To | Description | Default |
|-----------|-----------|-------------|---------|
| `samplingRate` | Prompt/workflow | Percentage of responses to evaluate (1-100) | All responses |
| `maxHourlyRuns` | Prompt/workflow | Cap on evaluation runs per hour | No limit |
| `intervalHours` | Hosted | Hours between evaluation runs | 1 |
| `maxTraces` | Hosted | Max data points per evaluation run | 1000 |
| `scenario` | Prompt/workflow | Evaluation scenario (`standard` or `business`) | `standard` |

### Disable

To temporarily disable without removing configuration:

```
Tool: continuous_eval_create
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
  evaluatorNames: ["groundedness"]   # Required but preserves existing config
  deploymentName: "gpt-4o"
  enabled: false
```

### Delete

To permanently remove continuous evaluation configuration:

```
Tool: continuous_eval_delete
Arguments:
  projectEndpoint: <project endpoint>
  configId: <id from continuous_eval_get>
  agentName: <agent name>
```

Always call `continuous_eval_get` first to retrieve the `id` field of the configuration to delete.

## Response Format

All tools return a unified `ContinuousEvalConfig` shape. The `get` tool returns a list; `create` returns a single object.

| Field | Description | Present For |
|-------|-------------|-------------|
| `id` | Configuration identifier (needed for delete) | All |
| `displayName` | Human-readable name | All |
| `enabled` | Whether evaluation is active | All |
| `evalId` | Linked evaluation group containing evaluator definitions | All |
| `agentName` | Target agent name | All |
| `status` | Provisioning status | Hosted only |
| `scenario` | Evaluation scenario (`standard` or `business`) | Prompt/workflow only |
| `samplingRate` | Percentage of responses evaluated | Prompt/workflow only |
| `maxHourlyRuns` | Cap on runs per hour | Prompt/workflow only |
| `intervalHours` | Hours between scheduled runs | Hosted only |
| `maxTraces` | Max data points per run | Hosted only |
| `createdAt` | Creation timestamp | All |
| `createdBy` | Creator identity | All |

## Related Skills

| User Intent | Skill |
|-------------|-------|
| "Evaluate my agent" / "Run a batch eval" | [observe skill](../observe/observe.md) |
| "Analyze production traces" | [trace skill](../trace/trace.md) |
| "Deploy my agent" | [deploy skill](../deploy/deploy.md) |
