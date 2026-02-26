---
name: microsoft-foundry
description: >-
  Use this skill for Microsoft Foundry (Azure AI Foundry) and all operation from Foundry MCP server: manage model deployment, manage hosted agent and prompt agent (create, deploy, invoke, run, troubleshoot, evaluate Foundry Agents), manage RBAC/permissions, manage quotas and capacity of deployments, manage Foundry resources.
  USE FOR: Microsoft Foundry, AI Foundry, hosted agent, create agent, deploy agent, invoke agent, evaluate agent, evaluation results, evaluation scores, find by response ID, agent traces, agent App Insights, GenAI telemetry, slow agent, agent errors, conversation ID, deploy models, create project, set up Foundry, RBAC setup, deployment capacity, Deployment quota, model availability, azd deploy agent.
  DO NOT USE FOR: Azure Functions (use azure-functions), App Service (use azure-create-app), AI Search/speech/OCR (use azure-ai). USE INSTEAD OF azure-monitor or azure-applicationinsights for Foundry agent traces, evaluations, or GenAI telemetry.
---

# Microsoft Foundry Skill

This skill helps developers work with Microsoft Foundry resources, covering model discovery and deployment, complete dev lifecycle of AI agent, evaluation workflows, and troubleshooting.

## Sub-Skills

> **MANDATORY: Before executing ANY workflow, you MUST read the corresponding sub-skill document.** Do not call MCP tools for a workflow without reading its skill document. This applies even if you already know the MCP tool parameters — the skill document contains required workflow steps, pre-checks, and validation logic that must be followed. This rule applies on every new user message that triggers a different workflow, even if the skill is already loaded.

This skill includes specialized sub-skills for specific workflows. **Use these instead of the main skill when they match your task:**

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Full deployment pipeline: project scan → env vars → Dockerfile → ACR build → agent creation → container startup → verification. **Use this skill instead of manually calling agent_update or az acr build.** USE FOR: deploy agent to foundry, push agent, build container, redeploy, start/stop container, clone/delete agent. | [deploy](foundry-agent/deploy/deploy.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](foundry-agent/invoke/invoke.md) |
| **troubleshoot** | View container logs, query telemetry, diagnose failures | [troubleshoot](foundry-agent/troubleshoot/troubleshoot.md) |
| **create** | Create new hosted agent applications. Supports Microsoft Agent Framework, LangGraph, or custom frameworks in Python or C#. Downloads starter samples from foundry-samples repo. | [create](foundry-agent/create/create.md) |
| **create-prompt** | Create prompt (LLM-based) agents via MCP tools or SDK. No container needed. Covers tool selection, model config, and instructions. | [create-prompt](foundry-agent/create/create-prompt.md) |
| **observe** | Eval-driven optimization loop for Foundry agents. Orchestrates the full pipeline: auto-create evaluators & test dataset → batch evaluate → cluster failures → optimize prompt → re-deploy → compare versions → iterate. **Use this skill instead of manually calling evaluation MCP tools.** USE FOR: evaluate agent, run eval, test agent quality, analyze eval results, cluster failures, optimize prompt, compare versions, CI/CD evals, agent monitoring. | [observe](foundry-agent/observe/observe.md) |
| **trace** | Analyze production traces for Foundry agents using App Insights and GenAI OTel conventions. Search conversations, diagnose failures, identify latency bottlenecks, reconstruct span trees. **Use this for runtime trace analysis, not troubleshoot (which is for container logs).** USE FOR: analyze traces, search conversations, find errors, slow traces, latency analysis, App Insights, GenAI telemetry. | [trace](foundry-agent/trace/trace.md) |
| **project/create** | Creating a new Azure AI Foundry project for hosting agents and models. Use when onboarding to Foundry or setting up new infrastructure. | [project/create/create-foundry-project.md](project/create/create-foundry-project.md) |
| **resource/create** | Creating Azure AI Services multi-service resource (Foundry resource) using Azure CLI. Use when manually provisioning AI Services resources with granular control. | [resource/create/create-foundry-resource.md](resource/create/create-foundry-resource.md) |
| **models/deploy-model** | Unified model deployment with intelligent routing. Handles quick preset deployments, fully customized deployments (version/SKU/capacity/RAI), and capacity discovery across regions. Routes to sub-skills: `preset` (quick deploy), `customize` (full control), `capacity` (find availability). | [models/deploy-model/SKILL.md](models/deploy-model/SKILL.md) |
| **quota**| Managing quotas and capacity for Microsoft Foundry resources. Use when checking quota usage, troubleshooting deployment failures due to insufficient quota, requesting quota increases, or planning capacity. | [quota/quota.md](quota/quota.md) |
| **rbac** | Managing RBAC permissions, role assignments, managed identities, and service principals for Microsoft Foundry resources. Use for access control, auditing permissions, and CI/CD setup. | [rbac/rbac.md](rbac/rbac.md) |

> 💡 **Tip:** For a complete onboarding flow: `project/create` → create/deploy/invoke. Use `create-prompt` for prompt (LLM-based) agents or `create` for hosted (container-based) agents.

> 💡 **Model Deployment:** Use `models/deploy-model` for all deployment scenarios — it intelligently routes between quick preset deployment, customized deployment with full control, and capacity discovery across regions.

## Agent Development Lifecycle

Match user intent to the correct workflow. Read each sub-skill in order before executing.

| User Intent | Workflow (read in order) |
|-------------|------------------------|
| Create a new prompt agent | [create-prompt](foundry-agent/create/create-prompt.md) |
| Create a new hosted agent from scratch | [create](foundry-agent/create/create.md) → [deploy](foundry-agent/deploy/deploy.md) → [invoke](foundry-agent/invoke/invoke.md) |
| Deploy an agent (code already exists) | deploy → invoke |
| Update/redeploy an agent after code changes | deploy → invoke |
| Invoke/test/chat with an agent | invoke |
| Troubleshoot an agent issue | invoke → troubleshoot |
| Fix a broken agent (troubleshoot + redeploy) | invoke → troubleshoot → apply fixes → deploy → invoke |
| Start/stop agent container | deploy |
| Evaluate/optimize an agent | [observe](foundry-agent/observe/observe.md) |
| Analyze production traces / find errors | [trace](foundry-agent/trace/trace.md) |
| Look up response ID / conversation ID | [trace](foundry-agent/trace/trace.md) |

## Agent: Project Context Resolution

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

### Step 3: Discover Foundry Resources

If the project endpoint is still missing after Steps 1–2, list available Foundry resources:

```bash
az cognitiveservices account list \
  --query "[?kind=='AIServices'].{Name:name, ResourceGroup:resourceGroup, Location:location}" \
  -o table
```

> 💡 **Tip:** Foundry resources are `Microsoft.CognitiveServices/accounts` with `kind=='AIServices'`. These are the multi-service resources that support model deployments, agents, and other Foundry capabilities.

| Result | Action |
|--------|--------|
| ✅ Resources found | Present as numbered list and ask user to select one |
| ❌ No resources | Ask: "No Foundry resources found. Would you like to create one?" → Route to [resource/create](resource/create/create-foundry-resource.md) |

Example selection prompt:
```
Found 3 Foundry resources:
  1. my-ai-resource   (rg-ai-dev,     eastus)
  2. prod-resource    (rg-prod,       westus2)
  3. experiment-res   (rg-research,   northcentralus)

Which resource would you like to use?
```

### Step 4: Confirm Selected Project

After selection, verify and display confirmation:

```bash
az cognitiveservices account show \
  --name <project-name> \
  --resource-group <resource-group> \
  --query "{Name:name, Location:location, ResourceGroup:resourceGroup, State:properties.provisioningState}" \
  -o table
```

```
Using project:
  Project:  <project-name>
  Region:   <location>
  Resource: <resource-group>
  State:    Succeeded

Proceeding with: <requested-operation>
```

> ⚠️ **Warning:** Never proceed with any operation without confirming the target project with the user. This prevents accidental operations on the wrong resource.

### Step 5: Collect Remaining Missing Values

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from previous steps. Common values skills may need:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the target agent

> 💡 **Tip:** If the user provides a project endpoint or agent name in their initial message, extract it directly — do not ask again.

## Agent: Agent Types

All agent skills support two agent types:

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment |
| **Hosted** | `"hosted"` | Container-based agents running custom code |

Use `agent_get` MCP tool to determine an agent's type when needed.

## Agent: MCP Tools (Prompt Agent CRUD)

Always try the Foundry MCP server first. Fall back to SDK only if MCP tools are unavailable.

| Tool | Operation | Description |
|------|-----------|-------------|
| `foundry_agents_list` | List | List all agents in a Foundry project |
| `foundry_agents_connect` | Get/Chat | Query or interact with an existing agent |
| `foundry_agents_create` | Create | Create a new agent with model, instructions, tools |
| `foundry_agents_update` | Update | Update agent instructions, model, or configuration |
| `foundry_agents_delete` | Delete | Remove an agent from the project |

> ⚠️ **Important:** If MCP tools are not available (tool call fails or user indicates MCP server is not running), fall back to the SDK approach. See [SDK Operations](foundry-agent/create/references/sdk-operations.md) for code samples.

## Agent: Available Tools

| Tool Category | Tools | Use Case |
|---------------|-------|----------|
| **Knowledge** | Azure AI Search, File Search, Microsoft Fabric | Ground agent with private data |
| **Web Search** | Web Search (default), Bing Grounding, Bing Custom Search | Ground agent with public web data |
| **Memory** | Memory Search | Persistent long-term memory across sessions |
| **Action** | Function Calling, Azure Functions, OpenAPI, MCP, Logic Apps | Take actions, call APIs |
| **Code** | Code Interpreter | Write and execute Python in sandbox |
| **Research** | Deep Research | Web-based research with o3-deep-research |

> ⚠️ **Web Search Default:** When users ask for web search, use the **Web Search** tool (`WebSearchPreviewTool`) by default. Only use **Bing Grounding** or **Bing Custom Search** when the user explicitly requests them.

> 📖 **Reference:** [Agent Tool Catalog](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/tool-catalog?view=foundry)

## Agent: Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent creation fails | Missing model deployment | Deploy a model first via `foundry_models_deploy` or portal |
| Permission denied | Insufficient RBAC | Need `Azure AI User` role on the project |
| Agent name conflict | Name already exists | Use a unique name or update the existing agent |
| Tool not available | Tool not configured for project | Verify tool prerequisites (e.g., Bing resource for grounding) |
| SDK version mismatch | Using 1.x instead of 2.x | Install `azure-ai-projects --pre` for v2.x preview |

## Tool Usage Conventions
- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer Azure MCP tools over direct CLI commands when available
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## Quick Reference

### Common Environment Variables

```bash
# Foundry Project
PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
MODEL_DEPLOYMENT_NAME=gpt-5-2

# Azure AI Search (for RAG)
AZURE_AI_SEARCH_CONNECTION_NAME=my-search-connection
AI_SEARCH_INDEX_NAME=my-index

# Evaluation
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-5-2
```

### Useful MCP Tools Quick Reference

**Resource Management**
- `foundry_resource_get` - Get resource details and endpoint

**Models**
- `foundry_models_list` - Browse model catalog
- `foundry_models_deploy` - Deploy a model
- `foundry_models_deployments_list` - List deployed models

**Knowledge & RAG**
- `foundry_knowledge_index_list` - List knowledge indexes
- `foundry_knowledge_index_schema` - Get index schema

**Agents**
- `foundry_agents_list` - List agents
- `foundry_agents_connect` - Query an agent
- `foundry_agents_create` - Create a new agent
- `foundry_agents_update` - Update agent config
- `foundry_agents_delete` - Delete an agent
- `foundry_agents_query_and_evaluate` - Query and evaluate

**OpenAI Operations**
- `foundry_openai_chat_completions_create` - Create chat completions
- `foundry_openai_embeddings_create` - Create embeddings

### Language-Specific Quick References

For SDK-specific details, authentication, and code examples:
- **Python**: See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md)

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
