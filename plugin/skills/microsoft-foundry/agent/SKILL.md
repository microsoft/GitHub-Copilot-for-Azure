---
name: agent
description: |
  Router skill for Azure AI Foundry agent lifecycle. Routes to specialized skills for packaging, deploying, invoking, and troubleshooting agents. Provides common project context resolution used by all agent skills.
  USE FOR: Foundry agent, build agent, ship agent, agent lifecycle, agent workflow, create Foundry agent, manage Foundry agent, debug agent.
  DO NOT USE FOR: Azure Functions (use azure-functions), non-agent Foundry features like model catalog or evaluations (use microsoft-foundry).
---

# Foundry Agent Lifecycle

Router skill for the full Azure AI Foundry agent developer experience. This skill resolves common project context and routes to the appropriate specialized skill.

## Skill Routing

```
User Request
    │
    ├── Containerize / Dockerfile / ACR / package → agent/package
    ├── Deploy / create / start / stop / status   → agent/deploy
    ├── Invoke / test / chat / send message        → agent/invoke
    └── Troubleshoot / debug / logs / errors       → agent/troubleshoot
```

| Scenario | Skill |
|----------|-------|
| Containerize agent, generate Dockerfile, build/push image to ACR | [package](package/SKILL.md) |
| Create, update, start/stop, or delete an agent deployment | [deploy](deploy/SKILL.md) |
| Send messages to an agent, single or multi-turn conversations | [invoke](invoke/SKILL.md) |
| View container logs, query telemetry, diagnose failures | [troubleshoot](troubleshoot/SKILL.md) |
| Creating AI agents and workflows using Microsoft Agent Framework SDK. Supports single-agent and multi-agent workflow patterns with HTTP server and F5/debug support. | [create/agent-framework/SKILL.md](create/agent-framework/SKILL.md) |

## Common: Project Context Resolution

Agent skills should run this step **only when they need configuration values they don't already have**. If a value (e.g., project endpoint, agent name) is already known from the user's message or a previous skill in the same session, skip resolution for that value.

### Step 1: Detect azd Project

If any required configuration value is missing, check if `azure.yaml` exists in the project root (workspace root or user-specified project path). If found, run `azd env get-values` to load environment variables.

### Step 2: Resolve Common Configuration

Match missing values against the azd environment:

| azd Variable | Resolves To | Used By |
|-------------|-------------|---------|
| `AZURE_AI_PROJECT_ENDPOINT` or `AZURE_AIPROJECT_ENDPOINT` | Project endpoint | deploy, invoke, troubleshoot |
| `AZURE_CONTAINER_REGISTRY_NAME` or `AZURE_CONTAINER_REGISTRY_ENDPOINT` | ACR registry name / image URL prefix | package, deploy |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | troubleshoot |

### Step 3: Collect Missing Values

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from the user's message, session context, or azd environment. Common values skills may need:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the target agent

> 💡 **Tip:** If the user provides a project endpoint or agent name in their initial message, extract it directly — do not ask again.

## Common: Agent Types

All agent skills support two agent types:

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment |
| **Hosted** | `"hosted"` | Container-based agents running custom code |

Use `agent_get` MCP tool to determine an agent's type when needed.

## Common: Tool Usage Conventions

These conventions apply to **all** agent skills:

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer Azure MCP tools over direct CLI commands when available
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## Common: MCP Server

All agent skills use tools from the `foundry-mcp` MCP server at `https://mcp.ai.azure.com`:

| Tool | Description |
|------|-------------|
| `agent_get` | List agents or get a specific agent's details |
| `agent_update` | Create, update, or clone an agent |
| `agent_delete` | Delete an agent with container cleanup |
| `agent_definition_schema_get` | Get JSON schema for agent definitions |
| `agent_invoke` | Send a message to an agent |
| `agent_container_control` | Start or stop a hosted agent container |
| `agent_container_status_get` | Check container running status |

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
