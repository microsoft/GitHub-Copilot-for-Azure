# Prompt Agent Deployment Workflow

Part of the [deploy skill](../deploy.md).

This reference covers the prompt-agent deployment flow from configuration through verification.

## Workflow

### Step 1: Collect Agent Configuration

Use the project endpoint from the project context (see Common: Project Context Resolution). Ask the user only for values not already resolved:
- **Agent name** -- Unique name for the agent
- **Model deployment** -- Model deployment name (e.g., `gpt-4o`)
- **Instructions** -- System prompt (optional)
- **Temperature** -- Response randomness 0-2 (optional, default varies by model)
- **Tools** -- Tool configurations (optional)

### Step 2: Get Agent Definition Schema

Use `agent_definition_schema_get` with `schemaType: prompt` to retrieve the current schema.

### Step 3: Create the Agent

Use `agent_update` with the agent definition:

```json
{
  "kind": "prompt",
  "model": "<model-deployment>",
  "instructions": "<system-prompt>",
  "temperature": 0.7
}
```

### Step 4: Test the Agent

Read and follow the [invoke skill](../../invoke/invoke.md) to send a test message and verify the agent responds correctly.

> **DO NOT stop here.** Continue to Step 5 (Auto-Create Evaluators & Dataset). This step is mandatory after every successful deployment.

### Step 5: Auto-Create Evaluators & Dataset

After a successful deployment, follow [Auto-Setup Evaluators & Dataset](../../observe/references/deploy-and-setup.md) to prepare evaluators and a seed dataset for the selected environment.

## Agent Definition Schema

### Prompt Agent

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `kind` | string | Yes | Must be `"prompt"` |
| `model` | string | Yes | Model deployment name (e.g., `gpt-4o`) |
| `instructions` | string | | System message for the model |
| `temperature` | number | | Response randomness (0-2) |
| `top_p` | number | | Nucleus sampling (0-1) |
| `tools` | array | | Tools the model may call |
| `tool_choice` | string/object | | Tool selection strategy |
| `rai_config` | object | | Responsible AI configuration |
