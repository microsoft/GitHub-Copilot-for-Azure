---
name: agents
description: |
  Manage Foundry Agent Service agents: create, list, get, update, delete prompt agents and workflows.
  USE FOR: create agent, delete agent, update agent, list agents, get agent, foundry agent, agent service, prompt agent, workflow agent, manage agent, agent CRUD, new foundry agent, remove agent.
  DO NOT USE FOR: creating agents with Microsoft Agent Framework SDK (use agent-framework), deploying agents to production (use agent/deploy), evaluating agents (use agent/evaluate).
---

# Foundry Agent Service Operations

Manage agents in Azure Foundry Agent Service — create, list, get, update, and delete prompt agents and workflows.

## Quick Reference

| Property | Value |
|----------|-------|
| **Service** | Azure Foundry Agent Service |
| **Agent Types** | Prompt (single agent), Workflow (multi-agent orchestration) |
| **Primary Tool** | Foundry MCP server (`foundry_agents_*` tools) |
| **Fallback SDK** | `azure-ai-projects` (v2.x preview) |
| **Auth** | `DefaultAzureCredential` / `az login` |

## When to Use This Skill

Use when the user wants to:

- **Create** a new prompt agent or workflow agent in Foundry Agent Service
- **List** existing agents in a Foundry project
- **Get** details of a specific agent
- **Update** an agent's instructions, model, or tools
- **Delete** an agent from a Foundry project

## Agent Types

| Type | Description | When to Use |
|------|-------------|-------------|
| **Prompt Agent** | Single agent with model, instructions, and tools | Simple Q&A, task-specific assistants, tool-augmented agents |
| **Workflow** | Multi-agent orchestration (sequential, group chat, human-in-loop) | Multi-step pipelines, approval flows, agent collaboration |

## MCP Tools (Preferred)

Always try the Foundry MCP server first. Fall back to SDK only if MCP tools are unavailable.

| Tool | Operation | Description |
|------|-----------|-------------|
| `foundry_agents_list` | List | List all agents in a Foundry project |
| `foundry_agents_connect` | Get/Chat | Query or interact with an existing agent |
| `foundry_agents_create` | Create | Create a new agent with model, instructions, tools |
| `foundry_agents_update` | Update | Update agent instructions, model, or configuration |
| `foundry_agents_delete` | Delete | Remove an agent from the project |

> ⚠️ **Important:** If MCP tools are not available (tool call fails or user indicates MCP server is not running), fall back to the SDK approach. See [SDK reference](references/sdk-operations.md) for code samples.

## Operation Workflow

```
User Request (create/list/get/update/delete agent)
    │
    ▼
Step 1: Resolve project context (endpoint + credentials)
    │
    ▼
Step 2: Try MCP tool for the operation
    │  ├─ ✅ MCP available → Execute via MCP tool → Done
    │  └─ ❌ MCP unavailable → Continue to Step 3
    │
    ▼
Step 3: Fall back to SDK
    │  Read references/sdk-operations.md for code
    │
    ▼
Step 4: Execute and confirm result
```

### Step 1: Resolve Project Context

The user needs a Foundry project endpoint. Check for:

1. `PROJECT_ENDPOINT` environment variable
2. Ask the user for their project endpoint
3. Use `foundry_resource_get` MCP tool to discover it

Endpoint format: `https://<resource>.services.ai.azure.com/api/projects/<project>`

### Step 2: Create Agent (MCP)

For a **prompt agent**:
- Provide: agent name, model deployment name, instructions
- Optional: tools (code interpreter, file search, function calling, Bing grounding)

For a **workflow**:
- Workflows are created in the Foundry portal visual builder
- Use MCP to create the individual agents that participate in the workflow
- Direct the user to the Foundry portal for workflow assembly

### Step 3: SDK Fallback

If MCP tools are unavailable, use the `azure-ai-projects` SDK:
- See [SDK Operations](references/sdk-operations.md) for create, list, update, delete code samples
- See [Agent Tools](references/agent-tools.md) for adding tools to agents

## Available Agent Tools

| Tool Category | Tools | Use Case |
|---------------|-------|----------|
| **Knowledge** | Azure AI Search, File Search, Bing Grounding, Microsoft Fabric | Ground agent with data |
| **Action** | Function Calling, Azure Functions, OpenAPI, MCP, Logic Apps | Take actions, call APIs |
| **Code** | Code Interpreter | Write and execute Python in sandbox |
| **Research** | Deep Research | Web-based research with o3-deep-research |

## References

| Topic | File | Description |
|-------|------|-------------|
| SDK Operations | [references/sdk-operations.md](references/sdk-operations.md) | Python SDK code for CRUD operations |
| Agent Tools | [references/agent-tools.md](references/agent-tools.md) | Adding tools to agents (code interpreter, search, functions) |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent creation fails | Missing model deployment | Deploy a model first via `foundry_models_deploy` or portal |
| Permission denied | Insufficient RBAC | Need `Azure AI User` role on the project |
| Agent name conflict | Name already exists | Use a unique name or update the existing agent |
| Tool not available | Tool not configured for project | Verify tool prerequisites (e.g., Bing resource for grounding) |
| SDK version mismatch | Using 1.x instead of 2.x | Install `azure-ai-projects --pre` for v2.x preview |
