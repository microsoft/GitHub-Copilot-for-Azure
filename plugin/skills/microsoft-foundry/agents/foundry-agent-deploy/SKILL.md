---
name: foundry-agent-deploy
description: |
  Create, update, and manage agent deployments in Azure AI Foundry. Supports both prompt agents (LLM-based) and hosted agents (container-based). Manages container lifecycle (start/stop) and monitors agent status.
  USE FOR: deploy agent, create agent, hosted agent, prompt agent, start container, stop container, agent status, clone agent, delete agent, agent container, Foundry agent deployment.
  DO NOT USE FOR: containerizing projects or building Docker images (use foundry-agent-package), invoking or testing agents (use foundry-agent-run), Azure Functions (use azure-functions).
---

# Foundry Agent Deploy

Create and manage agent deployments in Azure AI Foundry, including container lifecycle for hosted agents.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent types | Prompt (LLM-based), Hosted (container-based) |
| MCP server | `foundry-agent` |
| Key MCP tools | `agent_update`, `agent_container_control`, `agent_container_status_get` |
| Container protocols | `a2a`, `responses`, `mcp` |

## When to Use This Skill

- Create a new prompt agent with a model deployment
- Create a new hosted agent from a container image
- Start or stop hosted agent containers
- Check agent container status
- Update agent configuration or instructions
- Clone an existing agent
- Delete an agent (with automatic container cleanup)

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `agent_definition_schema_get` | Get JSON schema for agent definitions | `projectEndpoint` (required), `schemaType` (`prompt`, `hosted`, `tools`, `all`) |
| `agent_update` | Create, update, or clone an agent | `projectEndpoint`, `agentName` (required); `agentDefinition` (JSON), `isCloneRequest`, `cloneTargetAgentName`, `modelName` |
| `agent_get` | List all agents or get a specific agent | `projectEndpoint` (required), `agentName` (optional) |
| `agent_delete` | Delete an agent with container cleanup | `projectEndpoint`, `agentName` (required) |
| `agent_container_control` | Start or stop a hosted agent container | `projectEndpoint`, `agentName`, `action` (`start`/`stop`) (required); `agentVersion`, `minReplicas`, `maxReplicas` |
| `agent_container_status_get` | Check container running status | `projectEndpoint`, `agentName` (required); `agentVersion` |

## Workflow: Hosted Agent Deployment

### Step 1: Confirm Environment Variables

> ⚠️ **Warning:** This step is MANDATORY before creating a hosted agent. Environment variables are included in the agent payload and are difficult to change after deployment.

Present all environment variables (collected during packaging) to the user for confirmation. Display in a table with variable name and value. Mask sensitive values.

Loop until the user confirms or cancels:
- `yes` → Proceed to Step 2
- `VAR_NAME=new_value` → Update the value, show updated table, ask again
- `cancel` → Abort deployment

### Step 2: Collect Agent Configuration

Ask the user for:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Unique name for the agent
- **Model deployment** — Model deployment name (e.g., `gpt-4o`)
- **Instructions** — System prompt / agent instructions (optional)

### Step 3: Get Agent Definition Schema

Use `agent_definition_schema_get` with `schemaType: hosted` to retrieve the current schema and validate required fields.

### Step 4: Create the Agent

Use `agent_update` with the agent definition:

```json
{
  "kind": "hosted",
  "image": "<acr-name>.azurecr.io/<repository>:<tag>",
  "cpu": "<cpu-cores>",
  "memory": "<memory>",
  "container_protocol_versions": [
    { "protocol": "<protocol>", "version": "<version>" }
  ],
  "environment_variables": { "<var>": "<value>" }
}
```

### Step 5: Start Agent Container

Use `agent_container_control` with `action: start` to start the container.

### Step 6: Verify Agent Status

Use `agent_container_status_get` to poll until status is `Running`.

**Container status values:**
- `Starting` — Container is initializing
- `Running` — Container is active and ready ✅
- `Stopped` — Container has been stopped
- `Failed` — Container failed to start ❌

## Workflow: Prompt Agent Deployment

### Step 1: Collect Agent Configuration

Ask the user for:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Unique name for the agent
- **Model deployment** — Model deployment name (e.g., `gpt-4o`)
- **Instructions** — System prompt (optional)
- **Temperature** — Response randomness 0-2 (optional, default varies by model)
- **Tools** — Tool configurations (optional)

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

## Agent Definition Schemas

### Prompt Agent

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `kind` | string | ✅ | Must be `"prompt"` |
| `model` | string | ✅ | Model deployment name (e.g., `gpt-4o`) |
| `instructions` | string | | System message for the model |
| `temperature` | number | | Response randomness (0-2) |
| `top_p` | number | | Nucleus sampling (0-1) |
| `tools` | array | | Tools the model may call |
| `tool_choice` | string/object | | Tool selection strategy |
| `rai_config` | object | | Responsible AI configuration |

### Hosted Agent

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `kind` | string | ✅ | Must be `"hosted"` |
| `image` | string | ✅ | Container image URL |
| `cpu` | string | ✅ | CPU allocation (e.g., `"0.5"`, `"1"`, `"2"`) |
| `memory` | string | ✅ | Memory allocation (e.g., `"1Gi"`, `"2Gi"`) |
| `container_protocol_versions` | array | ✅ | Protocol and version pairs |
| `environment_variables` | object | | Key-value pairs for container env vars |
| `tools` | array | | Tool configurations |
| `rai_config` | object | | Responsible AI configuration |

### Container Protocols

| Protocol | Description |
|----------|-------------|
| `a2a` | Agent-to-Agent protocol |
| `responses` | OpenAI Responses API |
| `mcp` | Model Context Protocol |

## Agent Management Operations

### Clone an Agent

Use `agent_update` with `isCloneRequest: true` and `cloneTargetAgentName` to create a copy. For prompt agents, optionally override the model with `modelName`.

### Delete an Agent

Use `agent_delete` — automatically cleans up containers for hosted agents.

### List Agents

Use `agent_get` without `agentName` to list all agents, or with `agentName` to get a specific agent's details.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent creation failed | Invalid definition or missing required fields | Use `agent_definition_schema_get` to verify schema, check all required fields |
| Container start failed | Image not accessible or invalid configuration | Verify ACR image path, check cpu/memory values, confirm ACR permissions |
| Container status: Failed | Runtime error in container | Check container logs, verify environment variables, ensure image runs correctly |
| Permission denied | Insufficient Foundry project permissions | Verify Azure AI Owner or Contributor role on the project |
| Schema fetch failed | Invalid project endpoint | Verify project endpoint URL format: `https://<resource>.services.ai.azure.com/api/projects/<project>` |

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
