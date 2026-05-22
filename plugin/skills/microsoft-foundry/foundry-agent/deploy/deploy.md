# Foundry Agent Deploy

Create and manage agent deployments in Azure AI Foundry. For hosted agents, this includes the full workflow from containerizing the project to verifying the deployed agent.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent types | Prompt (LLM-based), Hosted |
| MCP server | `azure` |
| Key Foundry MCP tools | `agent_definition_schema_get`, `agent_update`, `agent_get` |
| CLI tools | `docker`, `az acr` (hosted agents only) |
| Container protocols | `a2a`, `responses`, `invocations`, `mcp` |
| Supported languages | .NET, Node.js, Python, Go, Java |

## When to Use This Skill

USE FOR: deploy agent to foundry, push agent to foundry, ship my agent, build and deploy container agent, deploy hosted agent, create hosted agent, deploy prompt agent, ACR build, container image for agent, docker build for foundry, redeploy agent, update agent deployment, clone agent, delete agent, azd deploy hosted agent, azd ai agent, azd up for agent, deploy agent with azd.

> **DO NOT manually run** `azd up`, `azd deploy`, `az acr build`, `docker build`, or `agent_update` **without reading this skill first.** This skill orchestrates the full deployment pipeline: project scan -> env var collection -> Dockerfile generation -> image build -> agent creation -> verification. Running CLI commands or calling MCP tools individually skips critical steps (env var confirmation, schema validation, RBAC setup, invocation verification).

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `agent_definition_schema_get` | Get JSON schema for agent definitions | `projectEndpoint` (required), `schemaType` (`prompt`, `hosted`, `tools`, `all`) |
| `agent_update` | Create, update, or clone an agent | `projectEndpoint`, `agentName` (required); `agentDefinition` (JSON), `isCloneRequest`, `cloneTargetAgentName`, `modelName` |
| `agent_get` | List all agents or get a specific agent | `projectEndpoint` (required), `agentName` (optional) |
| `agent_delete` | Delete an agent and clean up hosted-agent runtime resources | `projectEndpoint`, `agentName` (required) |

## Workflows

| Agent Type | Workflow |
|------------|----------|
| Hosted (container-based) | [Hosted Agent Deployment](references/deploy-hosted.md) |
| Prompt (LLM-based) | [Prompt Agent Deployment](references/deploy-prompt.md) |

## After Deployment

After a successful deployment:
1. [Display and document deployment context](references/post-deploy.md)
2. [Auto-Setup Evaluators & Dataset](../observe/references/deploy-and-setup.md)

## More Guidance

For agent cloning, deletion, deployment errors, non-interactive behavior, and supporting resources, see [Management and Errors](references/management-and-errors.md).
