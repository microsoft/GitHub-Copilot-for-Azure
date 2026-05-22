---
name: microsoft-foundry
description: "Deploy, evaluate, and manage Microsoft Foundry agents and models. Covers agent creation, provision, deployment, invocation, evaluation, trace analysis, prompt optimization, dataset curation, and RBAC. WHEN: \"deploy Foundry agent\", \"create Foundry agent\", \"evaluate agent\", \"optimize prompt\", \"deploy model\", \"troubleshoot agent\", \"dataset from traces\", \"continuous eval\", \"Foundry project\", \"hosted agent\". DO NOT USE FOR: Azure Functions, App Service, general Azure deployment."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Microsoft Foundry Skill

This skill helps developers work with Microsoft Foundry resources, covering model discovery and deployment, complete dev lifecycle of AI agent, evaluation workflows, and troubleshooting.

## Pre-Execution Requirements

> **MANDATORY: Before executing ANY workflow, you MUST first call the Azure MCP `foundry` tool and inspect the available Foundry MCP tools and related parameters.** Treat this initial `foundry` call as a discovery/help step. For this skill, Azure MCP `foundry` is the required entry point for Foundry-related MCP operations.

## Sub-Skills

> **MANDATORY: Before executing ANY workflow-specific steps, you MUST read the corresponding sub-skill document.** Do not call workflow-specific MCP tools for a workflow without reading its skill document. This applies even if you already know the MCP tool parameters -- the skill document contains required workflow steps, pre-checks, and validation logic that must be followed. This rule applies on every new user message that triggers a different workflow, even if the skill is already loaded.

This skill includes specialized sub-skills for specific workflows. **Use these instead of the main skill when they match your task:**

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Containerize, build, push to ACR, create/update/clone agent deployments. Routes to hosted-agent or prompt-agent workflows. | [deploy](foundry-agent/deploy/deploy.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](foundry-agent/invoke/invoke.md) |
| **observe** | Evaluate agent quality, run batch evals, analyze failures, optimize prompts, improve agent instructions, compare versions, set up CI/CD monitoring, and enable continuous production evaluation | [observe](foundry-agent/observe/observe.md) |
| **trace** | Query traces, analyze latency/failures, correlate eval results to specific responses via App Insights `customEvents` | [trace](foundry-agent/trace/trace.md) |
| **troubleshoot** | View hosted agent logs, query telemetry, diagnose failures | [troubleshoot](foundry-agent/troubleshoot/troubleshoot.md) |
| **create** | Create new hosted agent applications. Routes to greenfield (from template) or brownfield (convert existing) workflows. Supports Microsoft Agent Framework, LangGraph, or custom frameworks in Python or C#. | [create](foundry-agent/create/create-hosted.md) |
| **faos-optimize** | Convert existing Python agent code to a FAOS (Foundry Agent Optimization Service) optimization-ready version by wiring evaluator-targeted instructions/model/temperature knobs, then stop for review before deployment. | [faos-optimize](foundry-agent/faos-optimize/faos-optimize.md) |
| **eval-datasets** | Harvest production traces into evaluation datasets, manage dataset versions and splits, track evaluation metrics over time, detect regressions, and maintain full lineage from trace to deployment. Use for: create dataset from traces, dataset versioning, evaluation trending, regression detection, dataset comparison, eval lineage. | [eval-datasets](foundry-agent/eval-datasets/eval-datasets.md) |
| **project/create** | Creating a new Azure AI Foundry project for hosting agents and models. Use when onboarding to Foundry or setting up new infrastructure. | [project/create/create-foundry-project.md](project/create/create-foundry-project.md) |
| **resource/create** | Creating Azure AI Services multi-service resource (Foundry resource) using Azure CLI. Use when manually provisioning AI Services resources with granular control. | [resource/create/create-foundry-resource.md](resource/create/create-foundry-resource.md) |
| **private-network** | Answer questions about Foundry network isolation **and** deploy Foundry with VNet isolation (BYO VNet, Managed VNet, hybrid). Covers architecture concepts, template selection, deployment, and post-deployment validation. | [resource/private-network/private-network.md](resource/private-network/private-network.md) |
| **models/deploy-model** | Unified model deployment with intelligent routing. Handles quick preset deployments, fully customized deployments (version/SKU/capacity/RAI), and capacity discovery across regions. Routes to sub-skills: `preset` (quick deploy), `customize` (full control), `capacity` (find availability). | [models/deploy-model/SKILL.md](models/deploy-model/SKILL.md) |
| **quota** | Managing quotas and capacity for Microsoft Foundry resources. Use when checking quota usage, troubleshooting deployment failures due to insufficient quota, requesting quota increases, or planning capacity. | [quota/quota.md](quota/quota.md) |
| **rbac** | Managing RBAC permissions, role assignments, managed identities, and service principals for Microsoft Foundry resources. Use for access control, auditing permissions, and CI/CD setup. | [rbac/rbac.md](rbac/rbac.md) |

> **Tip:** For a complete onboarding flow: `project/create` (public) or `private-network` (VNet isolation) -> `models/deploy-model` -> agent workflows (`create` -> `deploy` -> `invoke`).

> **Model Deployment:** Use `models/deploy-model` for all deployment scenarios -- it intelligently routes between quick preset deployment, customized deployment with full control, and capacity discovery across regions.

> **Prompt Optimization:** For requests like "optimize my prompt" or "improve my agent instructions," load [observe](foundry-agent/observe/observe.md) and use the `prompt_optimize` MCP tool through that eval-driven workflow.

## Infrastructure and Agent Lifecycle

See [Lifecycle Routing](references/lifecycle-routing.md) to match user intent to the correct infrastructure or agent workflow.

## .foundry Workspace and Agent Types

See [.foundry Workspace Standard](references/foundry-workspace.md) for workspace layout, agent types, and setup references.

## Agent: Setup References

- [Standard Agent Setup](references/standard-agent-setup.md) - Standard capability-host setup with customer-managed data, search, and AI Services resources.

## Agent: Project Context Resolution

> **Scope:** Applies to deploy, invoke, observe, trace, troubleshoot, eval-datasets, faos-optimize. Does **not** apply to create (which uses `azd ai agent` CLI).

See [Project Context Resolution](references/project-context-resolution.md) for the full 5-step procedure: discover agent roots, select metadata file, resolve environment, bootstrap from azd, and collect missing values.

## Tool Usage Conventions

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer Azure MCP tools over direct CLI commands when available
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)

## SDK Quick Reference

- [Python](references/sdk/foundry-sdk-py.md)
