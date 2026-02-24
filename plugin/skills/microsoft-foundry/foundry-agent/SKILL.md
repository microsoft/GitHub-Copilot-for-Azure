---
name: foundry-agent
description: |
  Full agent lifecycle for Microsoft Foundry: create, deploy, invoke, and troubleshoot both prompt and hosted agents.
  USE FOR: create agent, deploy agent, invoke agent, test agent, troubleshoot agent, hosted agent, prompt agent, agent container, agent service, new agent, delete agent, update agent, list agents, agent CRUD, agent memory, agent tools, web search agent, bing grounding, azure ai search agent, MCP tool, function calling, code interpreter, start agent, stop agent, agent logs, chat with agent.
  DO NOT USE FOR: model deployment without agent context (use models/deploy-model), project creation (use project/create), RBAC setup (use rbac), quota management (use quota).
---

# Foundry Agent Skill

Full lifecycle for AI agents in Microsoft Foundry — create, deploy, invoke, and troubleshoot both prompt and hosted agents.

## Agent Types

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment. Created via MCP tools or SDK. No container needed. |
| **Hosted** | `"hosted"` | Container-based agents running custom code (Agent Framework, LangGraph, or custom). Deployed to ACA or vNext. |

Use `agent_get` MCP tool to determine an agent's type when needed.

## Agent Development Lifecycle

Match user intent to the correct workflow. Read each sub-skill in order before executing.

| User Intent | Workflow (read in order) |
|-------------|------------------------|
| Create a new prompt agent | [create-prompt](create/create-prompt.md) |
| Create a new hosted agent from scratch | [create-hosted](create/create.md) → [deploy](deploy/deploy.md) → [invoke](invoke/invoke.md) |
| Deploy an agent (code already exists) | [deploy](deploy/deploy.md) → [invoke](invoke/invoke.md) |
| Update/redeploy an agent after code changes | [deploy](deploy/deploy.md) → [invoke](invoke/invoke.md) |
| Invoke/test/chat with an agent | [invoke](invoke/invoke.md) |
| Troubleshoot an agent issue | [invoke](invoke/invoke.md) → [troubleshoot](troubleshoot/troubleshoot.md) |
| Fix a broken agent (troubleshoot + redeploy) | [invoke](invoke/invoke.md) → [troubleshoot](troubleshoot/troubleshoot.md) → apply fixes → [deploy](deploy/deploy.md) → [invoke](invoke/invoke.md) |
| Start/stop agent container | [deploy](deploy/deploy.md) |

## Project Context Resolution

Agent skills should run this step **only when they need configuration values they don't already have**. If a value (e.g., project endpoint, agent name) is already known from the user's message or a previous skill in the same session, skip resolution for that value.

### Step 1: Detect azd Project

If any required configuration value is missing, check if `azure.yaml` exists in the project root (workspace root or user-specified project path). If found, run `azd env get-values` to load environment variables.

### Step 2: Resolve Common Configuration

Match missing values against the azd environment:

| azd Variable | Resolves To | Used By |
|-------------|-------------|---------|
| `AZURE_AI_PROJECT_ENDPOINT` or `AZURE_AIPROJECT_ENDPOINT` | Project endpoint | deploy, invoke, troubleshoot |
| `AZURE_CONTAINER_REGISTRY_NAME` or `AZURE_CONTAINER_REGISTRY_ENDPOINT` | ACR registry name / image URL prefix | deploy |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | troubleshoot |

### Step 3: Collect Missing Values

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from the user's message, session context, or azd environment. Common values skills may need:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the target agent

> 💡 **Tip:** If the user provides a project endpoint or agent name in their initial message, extract it directly — do not ask again.

## MCP Tools (Prompt Agent CRUD)

Always try the Foundry MCP server first. Fall back to SDK only if MCP tools are unavailable.

| Tool | Operation | Description |
|------|-----------|-------------|
| `foundry_agents_list` | List | List all agents in a Foundry project |
| `foundry_agents_connect` | Get/Chat | Query or interact with an existing agent |
| `foundry_agents_create` | Create | Create a new agent with model, instructions, tools |
| `foundry_agents_update` | Update | Update agent instructions, model, or configuration |
| `foundry_agents_delete` | Delete | Remove an agent from the project |

> ⚠️ **Important:** If MCP tools are not available (tool call fails or user indicates MCP server is not running), fall back to the SDK approach. See [SDK Operations](create/references/sdk-operations.md) for code samples.

## Available Agent Tools

| Tool Category | Tools | Use Case |
|---------------|-------|----------|
| **Knowledge** | Azure AI Search, File Search, Microsoft Fabric | Ground agent with private data |
| **Web Search** | Web Search (default), Bing Grounding, Bing Custom Search | Ground agent with public web data |
| **Memory** | Memory Search | Persistent long-term memory across sessions |
| **Action** | Function Calling, Azure Functions, OpenAPI, MCP, Logic Apps | Take actions, call APIs |
| **Code** | Code Interpreter | Write and execute Python in sandbox |
| **Research** | Deep Research | Web-based research with o3-deep-research |

> ⚠️ **Web Search Default:** When users ask for web search, use the **Web Search** tool (`WebSearchPreviewTool`) by default. Only use **Bing Grounding** or **Bing Custom Search** when the user explicitly requests them.

## Tool Usage Conventions

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer Azure MCP tools over direct CLI commands when available
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## References

| Topic | File |
|-------|------|
| Create Prompt Agent | [create/create-prompt.md](create/create-prompt.md) |
| Create Hosted Agent | [create/create.md](create/create.md) |
| Deploy Agent | [deploy/deploy.md](deploy/deploy.md) |
| Invoke Agent | [invoke/invoke.md](invoke/invoke.md) |
| Troubleshoot | [troubleshoot/troubleshoot.md](troubleshoot/troubleshoot.md) |
| SDK Operations | [create/references/sdk-operations.md](create/references/sdk-operations.md) |
| Simple Tools | [create/references/agent-tools.md](create/references/agent-tools.md) |
| Web Search | [create/references/tool-web-search.md](create/references/tool-web-search.md) |
| Bing Grounding | [create/references/tool-bing-grounding.md](create/references/tool-bing-grounding.md) |
| Memory | [create/references/tool-memory.md](create/references/tool-memory.md) |
| Azure AI Search | [create/references/tool-azure-ai-search.md](create/references/tool-azure-ai-search.md) |
| MCP Tool | [create/references/tool-mcp.md](create/references/tool-mcp.md) |
| Agent Framework | [create/references/agentframework.md](create/references/agentframework.md) |
| Connections | [../project/connections.md](../project/connections.md) |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent creation fails | Missing model deployment | Deploy a model first via `foundry_models_deploy` or portal |
| Permission denied | Insufficient RBAC | Need `Azure AI User` role on the project |
| Agent name conflict | Name already exists | Use a unique name or update the existing agent |
| Tool not available | Tool not configured for project | Verify tool prerequisites (e.g., Bing resource for grounding) |
| SDK version mismatch | Using 1.x instead of 2.x | Install `azure-ai-projects --pre` for v2.x preview |
