# Continuous Evaluation -- Operations Reference

CRUD operations and response format for continuous evaluation. Part of the [Continuous Evaluation](continuous-eval.md) skill.

## Operations

### Check Current State

Before enabling or modifying, check what's already configured:

```yaml
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
```

- Empty list -> no continuous eval configured. Proceed to [Enable or Update](#enable-or-update).
- Non-empty list -> agent already has continuous eval. Present the configuration and ask what the user wants to change.

> [!] **Empty result is not proof of absence.** If the user expects a config to exist but the list is empty, verify the project endpoint and agent name match the intended environment before concluding it was never set up.

### Enable or Update

**Replace Semantics**: `continuous_eval_create` always creates a new evaluation group with the provided evaluators and points the evaluation rule at it. Always pass the complete desired configuration on every call -- omitted evaluators are dropped, not preserved.

> [!] **Do not assume `gpt-4o` exists.** Before setting `deploymentName`, verify a chat-capable deployment is available in the project. If none exists, quality evaluators cannot be enabled -- only safety evaluators (which do not require a deployment) will work.

```yaml
Tool: continuous_eval_create
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
  evaluatorNames: ["groundedness", "coherence", "fluency"]  # Illustrative -- align with your batch eval evaluators
  deploymentName: "gpt-4o"          # Required for quality evaluators
  enabled: true                      # Set false to disable without deleting
```

**Evaluator selection guidance:**
- **Quality evaluators** (require `deploymentName`): coherence, fluency, relevance, groundedness, intent_resolution, task_adherence, tool_call_accuracy
- **Safety evaluators** (no `deploymentName` needed): violence, sexual, self_harm, hate_unfairness, indirect_attack, code_vulnerability, protected_material
- Custom evaluators from the project's evaluator catalog are also supported by name.

**Optional parameters by agent kind:**

| Parameter | Applies To | Description | Default |
|-----------|-----------|-------------|---------|
| `samplingRate` | Prompt | Percentage of responses to evaluate (1-100) | All responses |
| `maxHourlyRuns` | Prompt | Cap on evaluation runs per hour | No limit |
| `intervalHours` | Hosted | Hours between evaluation runs | 1 |
| `maxTraces` | Hosted | Max data points per evaluation run | 1000 |
| `scenario` | Prompt | Evaluation scenario: `standard` (quality and safety metrics, default) or `business` (business success metrics). An agent can have one of each simultaneously. | `standard` |

### Disable

To temporarily disable without changing configuration, pass the configuration currently in use along with `enabled: false`. Because `continuous_eval_create` has replace semantics, omitting parameters will change the configuration when re-enabled. The `continuous_eval_get` response does not include evaluator names directly -- they are stored in the linked evaluation group -- so retrieve them via `evaluation_get` first. If multiple configurations are returned in the `continuous_eval_get` response, present the list to the user and ask which to target.

```yaml
# Step 1: Get the evalId, then retrieve current evaluators from the eval group
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
# Note the evalId from the response
```

```yaml
Tool: evaluation_get
Arguments:
  projectEndpoint: <project endpoint>
  evalId: <evalId from above>
# Note the evaluator names from the evaluation group's testing criteria
```

```yaml
# Step 2: Disable with the same evaluators
Tool: continuous_eval_create
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
  evaluatorNames: ["groundedness", "coherence", "fluency"]  # Must match current config
  deploymentName: "gpt-4o"
  enabled: false
```

### Delete

To permanently remove continuous evaluation configuration:

```yaml
Tool: continuous_eval_delete
Arguments:
  projectEndpoint: <project endpoint>
  configId: <id from continuous_eval_get>
  agentName: <agent name>
```

Always call `continuous_eval_get` first to retrieve the `id` field of the configuration to delete. If multiple configurations are returned, present the list to the user and ask which to target.

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
| `scenario` | Evaluation scenario (`standard` or `business`) | Prompt only |
| `samplingRate` | Percentage of responses evaluated | Prompt only |
| `maxHourlyRuns` | Cap on runs per hour | Prompt only |
| `intervalHours` | Hours between scheduled runs | Hosted only |
| `maxTraces` | Max data points per run | Hosted only |
| `createdAt` | Creation timestamp | All |
| `createdBy` | Creator identity | All |
