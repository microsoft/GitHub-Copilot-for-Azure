# Create Hosted Agent

Hosted Foundry agents are container-based agents that run user-authored code on
Foundry-managed infrastructure. The full lifecycle (scaffold, develop, configure,
deploy, operate, investigate) is owned by the Azure Developer CLI's `azd ai agent`
command and is documented in the `azure.ai.docs` extension (`azd ai doc`).

This file is a thin router: it sets up Foundry-specific context, points to the
right `azd ai doc agent <topic>` for each step, and hands off to sibling sub-skills
for Foundry-specific glue around deploy and operate. For LLM-only prompt agents
(no container), see [create-prompt.md](create-prompt.md). `hosted` is the only
`agent.kind` value supported by `azd ai agent`.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent kind | `hosted` |
| Primary CLI | `azd ai agent` (`azure.ai.agents` extension) |
| Authoritative docs | `azd ai doc agent|connection|toolbox|skill|routine <topic>` (`azure.ai.docs` extension) |
| Workspace | `<agent-root>/.foundry/` (per-environment metadata, evaluators, datasets) |
| Runtime auth | Local: `DefaultAzureCredential`. Production: `ManagedIdentityCredential`. |
| RBAC -- invocation | `Azure AI User` on the per-agent identity AND the project-level agent identity, at the Cognitive Services account scope. |
| RBAC -- toolboxes | Agent identity also needs `Foundry User` on the Foundry project (see `azd ai doc toolbox consume`). |

## When to Use This Skill

USE FOR: scaffolding a new hosted agent, "build me an agent that does X" where
the deliverable will deploy to Foundry as a container, bringing an existing
codebase under `azd ai agent` (brownfield), picking a Foundry hosted-agent sample,
hosted-agent first deploy, post-init wiring of model deployments / connections /
toolboxes / Foundry skills.

DO NOT USE FOR: pure prompt agents (use [create-prompt.md](create-prompt.md));
deploying an already-scaffolded project (use [../deploy/deploy.md](../deploy/deploy.md));
diagnosing a deployed agent (use [../troubleshoot/troubleshoot.md](../troubleshoot/troubleshoot.md)).

## Prerequisites

Verify the CLI and required extensions:

```bash
azd version --output json
azd extension list --output json
```

The list MUST include `azure.ai.agents`, `azure.ai.projects`, and `azure.ai.docs`.
Add `azure.ai.toolboxes` only if the agent will use a toolbox. Install missing
extensions with `azd extension install <name>`.

Verify the developer is signed in. Do NOT run `azd auth login` yourself -- it
opens a browser; ask the developer instead:

```bash
azd auth login --check-status
```

Pull the master `azd ai` router once per session before reading any sub-topic:

```bash
azd ai doc
```

The router prints the canonical session-start sequence (`azd ai project show`,
`azd ai agent show`, etc.), the topic tables for `agent` / `connection` / `toolbox`
/ `skill` / `routine`, the `--project-id` resolution rules, and the confirmation-
envelope handling rules. Follow its `Defaults` block for conventions this file
does not repeat (for example, `--output json` + `--no-prompt` on agent commands,
and the rule that doc commands never get `--output json`).

## Workflow

### Step 1: Greenfield or brownfield, new project or existing

Ask the developer:

> "Are we starting a fresh agent project, or bringing an existing codebase under
> `azd ai agent`? And are we deploying into a new Foundry project, or an existing
> one?"

| Combination | What changes |
|-------------|--------------|
| Fresh project, new Foundry project | Step 2 (sample) -> Step 3 (`init -m <manifestUrl>`); do NOT pass `--project-id`, `azd provision` creates the project. |
| Fresh project, existing Foundry project | Step 2 (sample) -> Step 3 (`init -m <manifestUrl> --project-id <arm-id>`). |
| Existing codebase | Skip Step 2. Step 3 uses `init --from-code`. Existing-project rules above still apply. |

> [!] Ask whether the Foundry project is new or existing BEFORE running
> `azd ai agent init`. Do NOT assume the developer has an existing project ID.
> Full rules in `azd ai doc` under "Resolving subscription, location, project ID".

### Step 2: Pick a starting sample (greenfield only)

```bash
azd ai doc agent samples
```

Covers `azd ai agent sample list`, the manifest URL shape, filtering by language
and feature, and what each starter category includes. Capture the chosen
sample's `manifestUrl` for Step 3.

### Step 3: Scaffold the project

```bash
azd ai doc agent initialize
```

Covers `azd ai agent init`, the difference between `-m <manifestUrl>` (greenfield)
and `--from-code` (brownfield), the prompts to expect, and the on-disk layout
produced. After init, two files own the agent's shape:

* `azure.yaml` -> `services.<name>.config` -- declares model deployments, model
  connections, toolboxes. Edited via `azd ai doc agent configure`.
* `<service-dir>/agent.yaml` -- flat ContainerAgent shape: env vars, endpoint
  path, agent card, runtime knobs. Edited via `azd ai doc agent extend`.

> [!] These two files own different fields. Putting a field in the wrong one is
> the single most common deploy failure. Always reach for `configure` or `extend`
> over memory.

### Step 4: Implement, run, and iterate locally

```bash
azd ai doc agent develop
```

Covers `azd ai agent run` (local dev loop), reserved environment variables, how
to inject local connection credentials, and how to attach a debugger.

> [!] Do NOT treat the scaffolded sample as the final agent. After scaffolding,
> open the generated source under `<service-dir>/` and implement the behavior
> the developer asked for: edit the agent entrypoint to satisfy "build me an
> agent that does X", keep the selected protocol consistent across source code +
> `agent.yaml` + `azd ai agent run` + deploy, and iterate locally until the
> agent answers correctly before handing off to deploy. If the project uses
> Microsoft Agent Framework, also read
> [Microsoft Agent Framework best practices](references/agentframework.md) for
> Foundry-specific runtime patterns (hosting adapter packages, agent naming
> rules, VS Code AI Toolkit debugging) that the external corpus does not cover.

### Step 5: Wire optional surfaces

Inspect `azure.yaml` first -- the chosen sample may already include the surfaces
the developer wants. To add a new surface:

| Want to ... | Read |
|-------------|------|
| Add or change a model deployment | `azd ai doc agent configure` |
| Add a non-MCP connection (Azure AI Search, Bing, OpenAPI, A2A) | `azd ai doc connection add` -> `azd ai doc connection auth-types` |
| Add a toolbox (group multiple tools under one MCP endpoint) | `azd ai doc toolbox add` -> `azd ai doc toolbox consume` |
| Bundle a versioned Foundry skill (project-scoped behavioral guideline) | `azd ai doc skill overview` -> `azd ai doc skill consume` |
| Tweak agent runtime fields (port, endpoint path, agent card) | `azd ai doc agent extend` |

### Step 6: Hand off to deploy

Once the agent runs cleanly locally, read [../deploy/deploy.md](../deploy/deploy.md).
The deploy skill detects `azd ai agent` scaffolding (presence of `agent.yaml`
plus `azure.yaml services.<name>.config`) and delegates the command sequence to
`azd ai doc agent deploy`, then layers on Foundry-specific post-deploy work that
is NOT in the external corpus: invocation RBAC, `.foundry/` metadata persistence,
auto-eval setup.

## Foundry-specific guardrails (apply throughout)

This file is the authoritative source for the items below. They are NOT all
repeated in the `azd ai doc` corpus.

* **Reserved env vars** -- `FOUNDRY_*`, `AGENT_*`, `PORT`, `HOME`,
  `SSE_KEEPALIVE_INTERVAL`, `APPLICATIONINSIGHTS_CONNECTION_STRING`,
  `OTEL_EXPORTER_OTLP_ENDPOINT` are platform-injected. User code may READ them
  but never SET them. `azd ai doc agent extend` covers where to put env vars on
  disk; the reserved-name list itself lives here.
* **Toolboxes need explicit creation** -- `azd deploy` does NOT auto-create
  toolboxes for post-init projects. Workflow: `azd ai toolbox create` ->
  `azd ai connection add` for any credentialed tool -> `azd env set
  TOOLBOX_<NAME>_MCP_ENDPOINT` -> wire the MCP client into agent code -> `azd
  deploy`. Full recipe: `azd ai doc toolbox add` + `azd ai doc toolbox consume`.
* **MCP request header** -- All toolbox MCP calls require
  `Foundry-Features: Toolboxes=V1Preview` on every request. See
  `azd ai doc toolbox consume`.
* **Foundry skill bundles** -- A Foundry skill RESOURCE is a versioned,
  project-scoped behavioral guideline. The consuming agent must download or copy
  it into `skills/<name>/SKILL.md` (NOT `skills/SKILL.md` at project root)
  before build/deploy, then pass `skill_directories=["./skills"]` (or the SDK
  equivalent) at session creation. Updating the skill on the Foundry project
  does NOT auto-refresh on `azd deploy`; re-run `azd ai skill download --force`
  then redeploy. See `azd ai doc skill consume`.
* **Auth** -- Local dev uses `DefaultAzureCredential`. Production uses
  `ManagedIdentityCredential`. Foundry injects credentials via reserved env
  vars; user code never reads them directly. See
  [auth-best-practices.md](../../references/auth-best-practices.md).
* **Project context** -- For endpoint / subscription / resource-group resolution
  rules used across sibling sub-skills, see
  [Project Context Resolution](../../SKILL.md#agent-project-context-resolution).

## Error Handling

Each `azd ai doc agent <topic>` page has a tailored Errors section -- read it
when a command fails. Otherwise:

| Symptom | First step |
|---------|------------|
| `azd ai agent ...` exits nonzero with no `next_step` block | `azd ai agent doctor --output json` |
| `init` reports a missing project ID after the developer said "existing project" | Ask for the ARM resource ID per `azd ai doc` (ai.azure.com -> Operate -> Admin -> Resource ID). |
| `init` fails because of missing extensions | Re-run the Prerequisites block above. |
| Confirmation envelope (exit 2 with `confirmation_required`) | Summarize `changes[]` in plain English, get explicit consent, then re-run the printed `confirmCommand` exactly. Never auto-append `--force`. Full spec: `azd ai doc agent operate`. |
| Post-deploy invocation fails | Continue to [../troubleshoot/troubleshoot.md](../troubleshoot/troubleshoot.md). |
| `auth login --check-status` reports not signed in | Ask the developer to run `azd auth login`. Never run it yourself. |

## Additional Resources

* `azd ai doc` -- master router; print once per session.
* [Foundry Hosted Agents concepts](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents)
* [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components)
* [Foundry Samples](https://github.com/microsoft-foundry/foundry-samples/)
* [Microsoft Agent Framework](https://github.com/microsoft/agent-framework)
