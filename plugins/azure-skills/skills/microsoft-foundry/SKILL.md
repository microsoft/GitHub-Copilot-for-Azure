---
name: microsoft-foundry
description: "Build, deploy, evaluate, optimize, fine-tune, and manage Microsoft Foundry agents, models, and resources end to end. USE FOR: foundry, azd ai agent, azd provision/deploy, hosted agent scaffold/develop/run/deploy/troubleshoot, prompt agent, managed harness agent, Copilot harness, voice agent, create/update/invoke/evaluate agent, add tool to agent, agent insights, batch/continuous eval, continuous monitoring, agent CI/CD, optimize/improve prompt, optimize agent instructions, Agent Optimizer, dataset curation from traces, deploy model, model fine-tuning (SFT/DPO/RFT), Foundry project, RBAC, role assignment, permissions, quota, capacity, region, deployment failure, AI Services, create Foundry resource, knowledge index, customize deployment, onboard, availability, training-data, grader, distillation, large file upload. DO NOT USE FOR: Azure Functions, App Service, general Azure deploy (use azure-deploy), general Azure prep (use azure-prepare)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Microsoft Foundry Skill

Guidance for Microsoft Foundry models, agents, resources, evaluation, and troubleshooting.

## Pre-Execution Requirements

Follow each applicable subsection below before starting its corresponding action or workflow.

### Dependency Check and Setup

First establish scope: plan, local implementation/test, or deployment. For an existing LangChain/LangGraph plan or local task, start with [LangChain and LangGraph hosting](foundry-agent/create/references/langchain-langgraph-hosting.md) and the application contract. Do not enter scaffold, deployment, cloud invocation, or metadata workflows unless requested. Read-only tasks perform no setup or execution.

**MANDATORY for execution that needs these dependencies:** Run the setup script before the corresponding workflow and wait for it to finish. It checks first and installs only missing dependencies. Do not run it merely to inspect or plan; local Python hosting work does not require installing azd or cloud tooling.

```bash
./scripts/check-and-setup-dependencies.sh     # macOS / Linux
./scripts/check-and-setup-dependencies.ps1    # Windows (pwsh)
```

Strictly follow the script output for subsequent actions.

### Workflow Guidance

**MANDATORY:** Before executing ANY workflow-specific steps, you MUST read the corresponding sub-skill document. Do not call workflow-specific MCP tools for a workflow without reading its skill document. This applies even if you already know the MCP tool parameters — the skill document contains required workflow steps, pre-checks, and validation logic that must be followed. This rule applies on every new user message that triggers a different workflow, even if the skill is already loaded.

### Foundry MCP

**MANDATORY:** Before using Foundry MCP operations, call the Azure MCP `foundry` tool and inspect the available Foundry MCP tools and related parameters. Treat this as the discovery/help step for MCP-based workflows.

### azd

**MANDATORY:** Before executing ANY azd command, you MUST read [azd-guidance](foundry-agent/azd-guidance/azd-guidance.md) and strictly follow the shared rules defined in it, especially the `AZURE_DEV_USER_AGENT` setting rules.

## Sub-Skills

This skill includes specialized sub-skills for specific workflows. **When a sub-skill matches the task, follow the portions within the requested scope:**

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Deploy hosted agents to Foundry, smoke-test a deployment, create or update prompt agents, and manage agent versions and multi-environment deploys. | [deploy](foundry-agent/deploy/deploy.md) |
| **cicd** | Set up a CI/CD deployment pipeline for a Foundry agent. | [cicd](foundry-agent/cicd/cicd.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](foundry-agent/invoke/invoke.md) |
| **routine** | Schedule or event-trigger Foundry agents with routines; use `azd` for CRUD, enable/disable, manual dispatch, and viewing past runs, or define routines in `azure.yaml`. | [routine](foundry-agent/routine/routine.md) |
| **invocations-ws** | Build, deploy, and connect to custom Hosted agents that use developer-defined duplex real-time or media streams over `invocations_ws`. | [invocations-ws](foundry-agent/invocations-ws/invocations-ws.md) |
| **observe** | Evaluate agent quality, run batch evals, analyze failures, optimize prompts, improve agent instructions, compare versions, set up CI/CD monitoring, and enable continuous production evaluation | [observe](foundry-agent/observe/observe.md) |
| **insights** | Pull generated agent insights, evidence, and recommendations from an existing monitor; read-only retrieval, not a new analysis run | [insights](foundry-agent/insights/insights.md) |
| **trace** | Query traces, analyze latency/failures, correlate eval results to specific responses via App Insights `customEvents` | [trace](foundry-agent/trace/trace.md) |
| **troubleshoot** | View hosted agent logs, query telemetry, diagnose failures | [troubleshoot](foundry-agent/troubleshoot/troubleshoot.md) |
| **validate** | Use only when the user explicitly asks to use this validation sub-skill or to validate Microsoft Foundry hosted-agent code against best practices. Never invoke it proactively or add it to another workflow. | [validate](foundry-agent/validate/validate.md) |
| **create (quick start)** | Create a new hosted Foundry agent from scratch end-to-end — scaffold, provision or use an existing Foundry project, deploy, and smoke-test. Do not use for any work on existing code. For anything not covered by the quickstart, use **create**. | [create/quick-start-hosted.md](foundry-agent/create/quick-start-hosted.md) |
| **create** | Use when the standard end-to-end happy path (quick start) doesn't fit. Create a new Foundry agent, update code of an existing agent, continue development of an existing agent, wire connections at scaffold time, use advanced setup or A2A (Agent2Agent), or recover from a failed quickstart run. | [create](foundry-agent/create/create-hosted.md) |
| **create managed harness** | Create or continue developing a Prompt Agent that explicitly uses the Foundry-managed Copilot harness. Uses `azd` and `azure.yaml`, not the ordinary Prompt Agent MCP workflow. | [create-managed-harness](foundry-agent/create/create-managed-harness.md) |
| **create voice** | Create, configure, or extend a Foundry Voice Agent, defaulting generic requests to managed Prompt Voice and supporting self-deployed Prompt Voice or two-agent Hosted Voice. | [create-voice](foundry-agent/create/create-voice.md) |
| **agent-optimizer** | Make existing Python hosted-agent code optimization-ready, configure eval.yaml, run Agent Optimizer jobs, apply candidates locally, and deploy through azd after review. | [agent-optimizer](foundry-agent/agent-optimizer/agent-optimizer.md) |
| **eval-datasets** | Harvest production traces into evaluation datasets, manage dataset versions and splits, track evaluation metrics over time, detect regressions, and maintain full lineage from trace to deployment. Use for: create dataset from traces, dataset versioning, evaluation trending, regression detection, dataset comparison, eval lineage. | [eval-datasets](foundry-agent/eval-datasets/eval-datasets.md) |
| **project/create** | Creating a new Microsoft Foundry project for hosting agents and models. Use when onboarding to Foundry or setting up new infrastructure. | [project/create/create-foundry-project.md](project/create/create-foundry-project.md) |
| **resource/create** | Creating Azure AI Services multi-service resource (Foundry resource) using Azure CLI. Use when manually provisioning AI Services resources with granular control. | [resource/create/create-foundry-resource.md](resource/create/create-foundry-resource.md) |
| **private-network** | Answer questions about Foundry network isolation **and** deploy Foundry with VNet isolation (BYO VNet, Managed VNet, hybrid). Covers architecture concepts, template selection, deployment, and post-deployment validation. | [resource/private-network/private-network.md](resource/private-network/private-network.md) |
| **models/deploy-model** | Unified model deployment with intelligent routing. Handles quick preset deployments, fully customized deployments (version/SKU/capacity/RAI), and capacity discovery across regions. Routes to sub-skills: `preset` (quick deploy), `customize` (full control), `capacity` (find availability). | [models/deploy-model/SKILL.md](models/deploy-model/SKILL.md) |
| **quota** | Managing quotas and capacity for Microsoft Foundry resources. Use when checking quota usage, troubleshooting deployment failures due to insufficient quota, requesting quota increases, or planning capacity. | [quota/quota.md](quota/quota.md) |
| **rbac** | Managing RBAC permissions, role assignments, managed identities, and service principals for Microsoft Foundry resources. Use for access control, auditing permissions, and CI/CD setup. | [rbac/rbac.md](rbac/rbac.md) |
| **finetuning** | Fine-tune models on Microsoft Foundry — SFT distillation, DPO preference optimization, RFT with graders and tool calling. Dataset preparation, grader calibration, training, checkpoint selection, deployment, evaluation. Use for: fine-tune, SFT, DPO, RFT, training data, grader, distillation, fine-tuned model, large file upload. | [finetuning/SKILL.md](finetuning/SKILL.md) |
| **azd-guidance** | Provide shared azd knowledge and guidance for managing Foundry agents. Read this first for any workflows related to azd. | [azd-guidance](foundry-agent/azd-guidance/azd-guidance.md) |

> 💡 **Tip:** For a complete onboarding flow: `project/create` (public) or `private-network` (VNet isolation) → `models/deploy-model` → agent workflows (`create` → `deploy` → `invoke`).

> 💡 **Fine-Tuning:** Use `finetuning` for all model customization — SFT distillation, DPO preference optimization, and RFT with graders. Includes quickstart, grader calibration, and training curve analysis.

> 💡 **Model Deployment:** Use `models/deploy-model` for all deployment scenarios — it intelligently routes between quick preset deployment, customized deployment with full control, and capacity discovery across regions.

> 💡 **Prompt Optimization:** For requests like "optimize my prompt" or "improve my agent instructions," load [observe](foundry-agent/observe/observe.md) and use the `prompt_optimize` MCP tool through that eval-driven workflow.

## Infrastructure Lifecycle

Match user intent to the correct infrastructure workflow.

| User Intent | Workflow |
|-------------|---------|
| "Create Foundry" / "Set up Foundry" (ambiguous) | Use `AskUserQuestion`: (a) just an AI Services resource, (b) a project with public access, or (c) a project with network isolation? Route: (a) → [resource/create](resource/create/create-foundry-resource.md), (b) → [project/create](project/create/create-foundry-project.md), (c) → [private-network](resource/private-network/private-network.md) |
| Set up Foundry with VNet isolation | [private-network](resource/private-network/private-network.md) |
| Create a Foundry project (public) | [project/create](project/create/create-foundry-project.md) |
| Create a bare Foundry resource | [resource/create](resource/create/create-foundry-resource.md) |

## Agent Development Lifecycle

Choose only the requested stages below. Read the selected workflow before executing its steps; complete dependency setup only when needed and read azd guidance before any azd command. Existing LangChain/LangGraph plans and local work use the direct reference rows, not deployment setup.

| User Intent | Workflow (read in order) |
|-------------|------------------------|
| Create or develop a Voice Agent (Prompt Voice or Hosted Voice) | [create-voice](foundry-agent/create/create-voice.md) → [deploy](foundry-agent/deploy/deploy.md) → [invoke](foundry-agent/invoke/invoke.md) |
| Create or develop an explicitly requested Managed Harness Agent / Copilot harness agent | [create-managed-harness](foundry-agent/create/create-managed-harness.md) → [deploy](foundry-agent/deploy/deploy.md) → [invoke](foundry-agent/invoke/invoke.md) |
| Create a new hosted agent end-to-end (scaffold + deploy + test) | [quick-start-hosted](foundry-agent/create/quick-start-hosted.md) (self-contained end-to-end) |
| Inspect or plan hosting an existing application (read-only) | Inspect source/configuration → [LangChain and LangGraph hosting](foundry-agent/create/references/langchain-langgraph-hosting.md); stop with facts, a scoped plan, and unverified boundaries |
| Run, repair, or adapt an existing LangChain/LangGraph application locally | [LangChain and LangGraph hosting](foundry-agent/create/references/langchain-langgraph-hosting.md) → installed public hosting API or specific guide section; no scaffold, deployment, Azure calls, or metadata bootstrap |
| Scaffold or deploy beyond the standard quickstart (existing code with authorized deployment, connections, A2A, recovery) | Inspect the existing application contract → required dependency setup → [azd-guidance](foundry-agent/azd-guidance/azd-guidance.md) before azd → [create](foundry-agent/create/create-hosted.md); only requested deploy/invoke stages |
| Optimize existing Python hosted agent | [agent-optimizer](foundry-agent/agent-optimizer/agent-optimizer.md) → scaffold/review → eval.yaml → optimize → apply candidate → deploy → invoke |
| Deploy an agent (code already exists) | [deploy](foundry-agent/deploy/deploy.md) → invoke → observe; only requested stages |
| Update/redeploy an agent after code changes | [deploy](foundry-agent/deploy/deploy.md) → invoke → observe; only requested stages |
| Set up a CI/CD deployment pipeline for a hosted agent | cicd |
| Invoke/test/chat with an agent | invoke |
| Schedule/event-trigger an agent, or CRUD/enable/disable/dispatch a routine | routine |
| Optimize / improve agent prompt or instructions | observe (Step 4: Optimize) |
| Evaluate and optimize agent (full loop) | observe |
| Enable continuous evaluation monitoring | observe (Step 6: CI/CD & Monitoring) |
| Pull agent insights / list generated issues and recommendations | [insights](foundry-agent/insights/insights.md) (all pages with expanded evidence; read-only) |
| Troubleshoot an agent issue | invoke → troubleshoot |
| Fix a broken agent (troubleshoot + redeploy) | invoke → troubleshoot → apply fixes → deploy → invoke |

## Agent: .foundry Workspace Standard

For Foundry cache/overlay work, follow [Agent Metadata Contract](references/agent-metadata-contract.md). Keep azd-owned deployment context authoritative; ask before refreshing or overwriting user-edited cache/metadata. An existing-app plan or local task does not require creating this workspace.

## Agent: Setup References

- [Standard Agent Setup](references/standard-agent-setup.md) — advanced setup for production workloads that need data-residency control (bring-your-own Cosmos DB / Storage / AI Search via a Foundry capability host). The default `azd ai agent` flow uses **Basic Agent Setup** and does **not** provision `capabilityHosts/agents` — do not flag its absence as a bug. For default post-provision state, see the "Expected env-var fingerprint" section in [foundry-agent/create/create-hosted.md](foundry-agent/create/create-hosted.md).

## Agent: Common Project Context Resolution

For create/deploy, cloud invocation, observe/trace, or metadata work, read [Detailed Context Resolution](references/agent-metadata-contract.md#detailed-context-resolution) only for values not already known. The canonical overlay schema and resolution workflow are maintained together there.

Existing-app read-only plans and local implementation/tests use the direct routing above. Do not resolve a cloud project, initialize metadata, scan unrelated evaluation configuration, or run azd for those tasks.

## Agent: Agent Types

Agent workflows distinguish four first-class agent types:

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment; managed via Foundry MCP or SDK |
| **Hosted** | `"hosted"` | Container-based agents running custom code; developed and deployed via `azd` |
| **Managed Harness Agent** | `"prompt"` with `harness.type: "microsoft_copilot_preview"` for new authoring | Prompt Agent running on the Foundry-managed Copilot harness; developed and deployed via `azd` |
| **Voice** | `"voice"` | Managed real-time Voice Agent — either **Prompt Voice** (1 agent, `modelType: managed` or `self_deployed`) or **Hosted Voice** (2 agents: `kind: voice` wrapper with `conversationEngine.type: hosted_agent` + `kind: hosted` target over `invocations_ws` `1.0.0` and Voice Live Bridge `1.0`); developed and deployed via `azd` and verified over the `voice` WebSocket endpoint |

Classify an `azure.yaml` service by its definition in this exact order, not by `host` alone:

1. `kind: voice` -> **Voice**. For compatibility, silently classify an existing `kind: prompt-voice` service as Voice, then normalize it when editing its YAML. Classify the subtype:
   - `conversationEngine.type: hosted_agent` -> **Hosted Voice wrapper** (paired with a named `kind: hosted` target service).
   - `modelType: managed` or `modelType: self_deployed` -> **Prompt Voice** (Foundry infers native speech-to-speech vs cascaded STT -> LLM -> TTS from `model.id`).
   - Having **both** `modelType`/`model` and `conversationEngine` is invalid (stop and fix `azure.yaml`); having **neither** is incomplete (do not guess). Never use obsolete `modelType: hosted_agent`, `targetAgent`, or a nested `config:` block.
2. `kind: hosted` -> **Hosted**. When it declares `protocols: [{ protocol: invocations_ws, version: 1.0.0 }]` and `metadata.voiceLiveCompatible: "true"` alongside a `kind: voice` wrapper, it is a **Hosted Voice target**; otherwise treat a standalone `invocations_ws` service as a **custom Hosted real-time/audio agent**.
3. `kind: prompt` plus `harness.type: microsoft_copilot_preview` or legacy `github_copilot_preview` -> **Managed Harness Agent**.
4. `kind: prompt` without that harness -> ordinary **Prompt Agent**.

Use `agent_get` only when the type cannot be resolved from project context. Preserve the harness discriminator already authored on an existing Managed Harness Agent; do not migrate it during ordinary edits or redeploys. Do not convert an existing Agent between Prompt, Hosted, Managed Harness Agent, and Voice types; create a new Agent instead. Before creating any **Voice Agent**, determine the model strategy first per [create-voice](foundry-agent/create/create-voice.md).

## Tool Usage Conventions

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer azd for Hosted Agents, Managed Harness Agents, and Voice Agents; prefer Foundry MCP for ordinary Prompt Agents.
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## Azure Authentication

- [Azure Authentication Best Practices](references/auth-best-practices.md)

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)

## Network Isolation Errors

For Foundry project/account calls, read [network-isolation guidance](references/auth-best-practices.md#network-isolation-errors) when errors identify disabled public access, a private-endpoint failure, or suspected private DNS. A generic 403 alone does not establish isolation. Preserve the existing network boundary.
