---
name: microsoft-foundry
description: "MANDATORY: Read this skill BEFORE calling any Foundry MCP tool. Use when working with Microsoft Foundry (Azure AI Foundry): deploy AI models, manage agents (create, deploy, invoke, troubleshoot), quotas, capacity, Foundry resources. USE FOR: Microsoft Foundry, AI Foundry, hosted agent, prompt agent, create agent, deploy agent, monitor agent, invoke agent, run agent, agent chat, evaluate agent, deploy model, model catalog, create Foundry project, set up Foundry, create Foundry resource, create AI Services, AIServices kind, register resource provider, role assignment, quota, capacity, TPM, deployment failure, standard agent setup, capability host. DO NOT USE FOR: Azure Functions (use azure-functions), App Service (use azure-create-app), generic Azure resource creation (use azure-create-app)."
---

# Microsoft Foundry Skill

> **MANDATORY:** Read this skill and the relevant sub-skill BEFORE calling any Foundry MCP tool.

## Sub-Skills

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Build, push to ACR, manage agent deployments | [deploy](foundry-agent/deploy/deploy.md) |
| **invoke** | Send messages to an agent | [invoke](foundry-agent/invoke/invoke.md) |
| **troubleshoot** | View logs, query telemetry, diagnose failures | [troubleshoot](foundry-agent/troubleshoot/troubleshoot.md) |
| **create** | Create new hosted agent apps (Agent Framework, LangGraph, custom) | [create](foundry-agent/create/create.md) |
| **project/create** | Create a new AI Foundry project | [project/create](project/create/create-foundry-project.md) |
| **resource/create** | Create AI Services resource via CLI | [resource/create](resource/create/create-foundry-resource.md) |
| **models/deploy-model** | Deploy models (preset, customized, or capacity discovery) | [models/deploy-model](models/deploy-model/SKILL.md) |
| **quota** | Check quota, troubleshoot insufficient quota, request increases | [quota](quota/quota.md) |
| **rbac** | RBAC, role assignments, managed identities, service principals | [rbac](rbac/rbac.md) |

Onboarding flow: `project/create` → `deploy` → `invoke`

## Agent Lifecycle

| Intent | Workflow |
|--------|----------|
| New agent from scratch | create → deploy → invoke |
| Deploy existing code | deploy → invoke |
| Test/chat with agent | invoke |
| Troubleshoot | invoke → troubleshoot |
| Fix + redeploy | troubleshoot → fix → deploy → invoke |

## Project Context Resolution

Resolve only missing values. Extract from user message first, then azd, then ask.

1. Check for `azure.yaml`; if found, run `azd env get-values`
2. Map azd variables:

| azd Variable | Resolves To |
|-------------|-------------|
| `AZURE_AI_PROJECT_ENDPOINT` / `AZURE_AIPROJECT_ENDPOINT` | Project endpoint |
| `AZURE_CONTAINER_REGISTRY_NAME` / `AZURE_CONTAINER_REGISTRY_ENDPOINT` | ACR registry |
| `AZURE_SUBSCRIPTION_ID` | Subscription |

3. Ask user only for unresolved values (project endpoint, agent name)

## Validation

After each workflow step, validate before proceeding:
1. Run the operation
2. Check output for errors or unexpected results
3. If failed → diagnose using troubleshoot sub-skill → fix → retry
4. Only proceed to next step when validation passes

## Agent Types

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based, backed by model deployment |
| **Hosted** | `"hosted"` | Container-based, running custom code |

## Agent: Setup Types

| Setup | Capability Host | Description |
|-------|----------------|-------------|
| **Basic** | None | Default. All resources Microsoft-managed. |
| **Standard** | Azure AI Services | Bring-your-own storage and search. See [standard-agent-setup](references/standard-agent-setup.md). |

> **MANDATORY:** For standard setup, read [references/standard-agent-setup.md](references/standard-agent-setup.md) before proceeding. It contains required connections, Bicep template reference, and async provisioning instructions.

## Tool Usage Conventions

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer Azure MCP tools over direct CLI commands when available
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## References

- [Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
- [Python SDK](references/sdk/foundry-sdk-py.md)

## Dependencies

Scripts in sub-skills require: Azure CLI (`az`) ≥2.0, `jq` (for shell scripts). Install via `pip install azure-ai-projects azure-identity` for Python SDK usage.