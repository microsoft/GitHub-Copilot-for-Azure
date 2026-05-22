# Continuous Evaluation

Enable, configure, disable, or remove continuous evaluation for a Foundry agent. Continuous evaluation automatically assesses agent responses on an ongoing basis using configured evaluators (e.g., groundedness, coherence, violence detection). This is typically the final step in the [observe loop](../observe.md) after deploying and batch-evaluating an agent -- it keeps production quality visible without manual intervention.

## When to Use This Skill

USE FOR: enable continuous evaluation, disable continuous evaluation, configure continuous eval, set up monitoring evaluators, check continuous eval status, delete continuous eval, update evaluators, change sampling rate, change eval interval, production monitoring, ongoing agent quality.

DO NOT USE FOR: running a one-off batch evaluation (use [observe](../observe.md)), querying traces (use [trace](../../trace/trace.md)), creating evaluator definitions (use [observe](../observe.md) Step 1).

## Quick Reference

| Property | Value |
|----------|-------|
| MCP server | `azure` |
| Key MCP tools | `continuous_eval_create`, `continuous_eval_get`, `continuous_eval_delete`, `agent_get`, `evaluation_get` |
| Prerequisite | Agent must exist in the project |
| Local cache | `.foundry/agent-metadata.yaml` |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Enable continuous eval" / "Set up monitoring evaluators" | [Before Starting](#before-starting-detect-current-state) -> [Enable or Update](#enable-or-update) |
| "Is continuous eval running?" / "Check eval status" | [Before Starting](#before-starting-detect-current-state) -> [Check Current State](#check-current-state) |
| "Change evaluators" / "Update sampling rate" | [Before Starting](#before-starting-detect-current-state) -> [Check Current State](#check-current-state) -> [Enable or Update](#enable-or-update) |
| "Pause evaluations" / "Disable continuous eval" | [Before Starting](#before-starting-detect-current-state) -> [Disable](#disable) |
| "Stop evaluating this agent" / "Delete continuous eval" | [Before Starting](#before-starting-detect-current-state) -> [Delete](#delete) |
| "Scores are dropping" / "Act on monitoring results" | [Before Starting](#before-starting-detect-current-state) -> [Acting on Results](continuous-eval-remediation.md) |

> [!] **Important:** Always run [Before Starting](#before-starting-detect-current-state) to resolve the project endpoint and agent name before calling any MCP tools.

## Before Starting: Detect Current State

1. Resolve the target agent root and environment from `.foundry/agent-metadata.yaml` using the [Project Context Resolution](../../../SKILL.md#agent-project-context-resolution) workflow.
2. Extract `projectEndpoint` and `agentName` from the selected environment. If not available in metadata, use `ask_user` to collect them.
3. Use `agent_get` to verify the agent exists and note its kind (prompt or hosted).
4. Use `continuous_eval_get` to check for existing continuous evaluation configuration.
5. Jump to the appropriate entry point based on user intent.

## How It Works

The tool auto-detects the agent's kind and uses the appropriate backend:

- **Prompt agents** -- evaluation runs are triggered automatically each time the agent produces a response. Parameters: `samplingRate` (percentage of responses to evaluate), `maxHourlyRuns`.
- **Hosted agents** -- evaluation runs are triggered on an hourly schedule, pulling recent traces from App Insights. Parameters: `intervalHours` (hours between runs), `maxTraces` (max data points per run).

The user does not need to choose between these -- the tool handles it based on agent kind.

## Behavioral Rules

1. **Always resolve context first.** Run [Before Starting](#before-starting-detect-current-state) before calling any MCP tool. Never assume a project endpoint or agent name.
2. **Check before creating.** Always call `continuous_eval_get` before `continuous_eval_create` to determine whether to create or update. Present existing configuration to the user.
3. **Confirm evaluator selection.** Present the evaluator list to the user before enabling. Distinguish quality evaluators (require `deploymentName`) from safety evaluators (do not).
4. **Prompt for next steps.** After each operation, present options. Never assume the path forward (e.g., after enabling, offer to check status or adjust parameters).
5. **Keep context visible.** Include the project endpoint, agent name, and environment in operation summaries.
6. **Use `continuous_eval_get` for IDs.** The `delete` tool requires a `configId` -- always retrieve it from the `get` response rather than asking the user to provide it.
7. **Surface the remediation path.** When presenting continuous eval results that show score degradation, always offer to route into the [observe skill](../observe.md) for diagnosis and optimization. Monitoring without action is incomplete.
8. **Handle agent-not-found.** If `agent_get` returns a not-found error, stop the continuous eval flow. Offer to route to the [deploy skill](../../deploy/deploy.md) to create the agent first, or ask the user to verify the agent name and environment.
9. **Handle auth and endpoint errors.** If `agent_get` or `continuous_eval_create` returns a permission or authentication error, verify the project endpoint, environment, and user access. Do not suggest creating the agent -- the issue is access, not existence.
10. **Validate `deploymentName` before enabling.** Do not assume `gpt-4o` exists. If quality evaluators are selected, verify a chat-capable deployment is available in the project. If none exists, stop and explain that quality evaluators cannot be enabled until a compatible deployment is provisioned.
11. **Handle invalid evaluator names.** If `continuous_eval_create` returns an invalid evaluator name error, call `evaluator_catalog_get` to list available evaluators and present valid options. Do not retry with the same arguments.
12. **Handle unexpected empty config.** If `continuous_eval_get` returns an empty list for an agent the user believes has continuous eval configured, verify the agent name and project endpoint match the intended environment in `.foundry/agent-metadata.yaml`. The configuration may exist under a different environment or resolved `agentName`.

## Operations

See [Operations Reference](continuous-eval-operations.md) for the full CRUD workflow: check current state, enable or update, disable, and delete continuous evaluation configurations.

## Acting on Results

When continuous evaluation detects score degradation, follow the [remediation workflow](continuous-eval-remediation.md) to diagnose, fix, and verify the issue through the observe loop.

## Response Format

See [Operations Reference](continuous-eval-operations.md#response-format) for the `ContinuousEvalConfig` response shape.

## Related Skills

| User Intent | Skill |
|-------------|-------|
| "Evaluate my agent" / "Run a batch eval" | [observe skill](../observe.md) |
| "Scores are dropping" / "Diagnose and fix quality regression" | [observe skill](../observe.md) (Steps 3-5) |
| "Analyze production traces" / "Find flagged conversations" | [trace skill](../../trace/trace.md) |
| "Deploy my agent" / "Redeploy after fix" | [deploy skill](../../deploy/deploy.md) |
