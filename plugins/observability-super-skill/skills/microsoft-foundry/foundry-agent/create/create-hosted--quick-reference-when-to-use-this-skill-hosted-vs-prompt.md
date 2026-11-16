# Selected guidance: Quick Reference; When to Use This Skill; Hosted vs Prompt vs Voice; azd Sample Selection Guidance; Workflow; Step 1 -- Verify the environmen

> Reading grants no execution approval. Apply current-request intent and
> standalone availability gates. Analyze supplied evidence in memory without
> Azure/Python, installs, auth, cache, writes or jobs. Missing/denied/empty/
> partial evidence stays distinct; insufficient evidence is INCONCLUSIVE.
> Live reads need verified operations/schemas, approved scope/window and finite
> budgets. Lifecycle actions, sensitive content, traffic, persistence, edits
> and deployment need separate explicit approval. Retain prerequisites from
> reached steps; missing prerequisites block operations. These rules supersede
> conflicting automatic actions in retained examples.

[Execution boundaries](../../references/execution-boundaries.md) apply to the selected action.

# Create Hosted Agent (azd ai)

Scaffold or develop a hosted Foundry agent project with the Azure Developer CLI (`azd`) and the `azure.ai.agents` extension. The same flow covers new agents and continued development of existing agents, then drops you into a local inner-loop so you can iterate before deploying.

> **Creating a new agent end-to-end from scratch?** Use [quick-start-hosted.md](quick-start-hosted.md) instead -- an opinionated happy-path with safe defaults. Stay here for anything not covered by the quickstart.

> **Scope:** `azd ai` is the preferred *code-first* path -- use it when the intent is agent code on disk, in a repo, with infrastructure-as-code and a local inner-loop. If the intent is only to create a remote agent resource (no code on disk), other approaches may apply -- for ordinary prompt agents see [create-prompt.md](create-prompt.md). For Voice Agents, use [create-voice.md](create-voice.md). A Managed Harness Agent also uses azd but is `kind: prompt`; use [create-managed-harness.md](create-managed-harness.md).

## Quick Reference

| Property | Value |
|----------|-------|
| Agent type | Hosted (container or code) |
| Primary CLI | `azd ai agent` (from extension `azure.ai.agents`) |
| Scaffold command | `azd ai agent init -m <manifestUrl> --deploy-mode code --runtime python_3_13 --entry-point main.py`, pass `--runtime dotnet_10 --entry-point MyAgent.dll` for .NET project (or `--src <dir>` when onboarding existing code) |
| Local run | Follow [local-run](references/local-run.md) for the service's protocol-specific invocation path |
| Deploy handoff | [deploy/deploy.md](../deploy/deploy.md) |
| Sample catalog | `azd ai agent sample list --output json` |
| Reference docs | [azd-ai-cli](../azd-guidance/references/azd-ai-cli.md), [local-run](references/local-run.md), [toolbox.md](../toolbox/toolbox.md) |

## When to Use This Skill

- Create a new hosted agent from a curated Foundry sample.
- Continue developing on an existing agent project (Python, .NET).
- Add tools (web search, AI Search, MCP, A2A) to a hosted agent.
- Run and iterate on a hosted agent locally before deploying.

For ordinary prompt agents, use [create-prompt.md](create-prompt.md). For a Prompt Agent with `harness.type: microsoft_copilot_preview` or legacy `github_copilot_preview`, use [create-managed-harness.md](create-managed-harness.md). For deploy, use [deploy.md](../deploy/deploy.md).

## Hosted vs Prompt vs Voice

| | Hosted | Prompt | Managed Harness Agent | Voice |
|--|--------|--------|-----|-------|
| Definition | Custom Python / .NET code | Model + instructions | Prompt agent with Copilot harness | Prompt Voice (`modelType: managed` / `self_deployed`) or Hosted Voice (`kind: hosted` target + `kind: voice` wrapper) |
| Workflow | This skill | [create-prompt.md](create-prompt.md) | [create-managed-harness.md](create-managed-harness.md) | [create-voice.md](create-voice.md) |
| Tools | Prefer Toolbox + connections | Direct tool configs | Prefer direct tools; Toolbox only when explicit | Prompt Voice configures tools directly; Hosted Voice tools belong to the target, never the wrapper |
| Local debugging | `azd ai agent run --no-client` | Limited | No local harness runtime | None for Prompt Voice; target-only Bridge validation for Hosted Voice |
| Output | Immutable version via `azd deploy` | `agent_update` via MCP / SDK | Immutable version via `azd deploy` | Immutable Voice and target versions via `azd deploy` |

## azd Sample Selection Guidance

Use this azd sample selection guidance when the workflow refers to azd sample selection guidance.

List the curated catalog (filter by language if known):

```bash
azd ai agent sample list --language python --output json
```

Capture the selected sample's `manifestUrl`.

> **Important:** Always select the best-matching samples from `azd ai agent sample list` for the capabilities the user explicitly requested. Use advanced tool samples only when the user explicitly asks for external actions, APIs, tools, connectors, or data lookup. Starting with the right sample helps ensure that the implementation follows the established code patterns and best practices for that type of Foundry hosted agent. If `azd ai agent sample list` does not return a suitable sample, choose one from the official [Foundry samples repository](https://github.com/microsoft-foundry/foundry-samples) and construct the manifest URL from its exact `azure.yaml` path, following the URL format returned by `azd ai agent sample list`.

You should pick only one sample for `azd ai agent init`, but you can browse multiple samples relevant to the user's task as code references.

> **Important:** When users want to create or continue working on LangChain/LangGraph agents, you MUST read and follow [LangChain and LangGraph hosting](references/langchain-langgraph-hosting.md) before selecting a sample or changing agent code.

## Workflow

### Step 1 -- Verify the environment

Run the bundled read-only Copilot app entry preflight without asking for approval; it locates the app's Copilot CLI and reports whether the `microsoft-foundry` canvas plugin needs installation:

```bash
./scripts/check-copilot-app-entry.sh     # macOS / Linux
./scripts/check-copilot-app-entry.ps1    # Windows (pwsh)
```

Act on the summary prefixes:

- `[OK]` -- nothing to do.
- `[WARN]` -- non-blocking; continue.
- `[ACTION]` -- try to resolve by using the exact plugin install command emitted by the preflight; ask before installing in interactive mode, and install directly in non-interactive mode.
  - **On successful installation, you MUST print:** "The `microsoft-foundry` canvas extension is installed and will be available in a new session." Then rerun the preflight.
  - If installation is declined or fails, warn and continue; do not retry.

Then run the bundled verification script before any create/deploy command:

```bash
./scripts/verify-environment.sh     # macOS / Linux
./scripts/verify-environment.ps1    # Windows (pwsh)
```

Do not continue past Step 1 while any `[ACTION]` from environment verification remains. Never run `az login` or `azd auth login` for the user. Missing authentication is a hard stop before any `azd ai agent init`, `azd provision`, `azd deploy`, or other deploy command.

Act on the summary prefixes:

- `[OK]` -- nothing to do.
- `[WARN]` -- non-blocking; continue.
- `[ACTION]` -- resolve first, then rerun the script. If `az` or `azd` is missing, ask before installing in interactive mode; install directly in non-interactive mode. For how to install `azd`, see <https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd>. In any mode, never run `az login` or `azd auth login`; stop and ask the user to log in manually. Missing `azure.ai.agents` / `azure.ai.projects` extensions may be resolved with `azd extension install <name>`. Failed `az` or `azd` auth checks must stop the workflow until the user logs in manually.

Branch on the agent status reported by `verify-environment`:

- `not_deployed` -> Step 2.
- `active` / `deployed` -> for code changes, continue to Step 4b; for deploy-only requests, use [deploy/deploy.md](../deploy/deploy.md); to add a tool, use [toolbox.md](../toolbox/toolbox.md).

### Step 2 -- Collect necessary information

Before asking, resolve values from the user's request, the workspace,
`azure.yaml`, the Step 1 verification output, and `azd env get-values`. For each
row, do not ask when its **When to skip** condition is met. Ask for all
remaining applicable values in one `AskUserQuestion` round. Do not ask for
values that are already resolved or irrelevant to the requested change.
Populate each question with the default option below.

| Value | When to skip | Default option | Notes |
|-------|--------------|----------------|-------|
| Project / agent name | The user provided one, or the existing code already defines one. | Project: `ai-project-<random>`; agent: the selected sample's agent name | Generate `<random>` using 6-8 lowercase alphanumeric characters. Pass the agent name to `azd ai agent init` with `--agent-name`; it sets the service key and agent name in `azure.yaml`. For a new Foundry project, set the project name after init with `azd env set AZURE_AI_PROJECT_NAME "<project-name>"` before running `azd provision`. |
| Language | The user provided one, or the existing code already determines it. | Python | Supported languages: Python and .NET. |
| Subscription | The active azd environment already contains the intended `AZURE_SUBSCRIPTION_ID`. | Active Azure subscription: `<subscription-name>` (`<subscription-id>`) | Resolve both values with `az account show --query "{name:name,id:id}" -o json`; the ID must be a subscription GUID. |
| Region | The active azd environment already contains the intended `AZURE_LOCATION`, or this change does not provision regional resources. | `northcentralus` | Azure resource location. |
| Foundry project | The workspace or azd environment is already configured with a Foundry project, or the user provided one. | New Foundry project | Offer a new or existing project. For a new project, do not pass `--project-id`; `azd provision` creates it. For an existing project, use its ARM resource ID with `azd ai agent init --project-id`. |
| Foundry model deployment | The user provided one; it is already resolved from `azure.yaml` or the active azd environment; or the requested change does not affect model selection. | Official sample's model selection | If the user specifies a model deployment, collect its deployment name.|
| Deploy mode | Always — resolve without asking. | `code` | Priority: explicit user request → existing configuration → `code` for a new agent. Use `container` only when explicitly requested or already configured. |
| ACR | Deploy mode is `code`, or the ACR choice is already determined in the existing configs. | New Azure Container Registry | Offer a new or existing registry. When creating a new ACR, leave `AZURE_CONTAINER_REGISTRY_NAME`, `AZURE_CONTAINER_REGISTRY_ENDPOINT`, and `AZURE_CONTAINER_REGISTRY_RESOURCE_ID` unset; `azd provision` will create one. |

If the user chooses an existing Foundry project and supplies only its endpoint,
resolve the project ARM resource ID with the bundled script:

  ```bash
  ./scripts/resolve-project-id.sh --endpoint "<foundry-project-endpoint>"     # macOS / Linux
  ./scripts/resolve-project-id.ps1 -Endpoint "<foundry-project-endpoint>"     # Windows (pwsh)
  ```

Do not guess, derive, or construct the project ID from the endpoint. For `--project-id`, pass either the user-supplied project ARM resource ID or the `id` returned by Azure lookup / the bundled resolve script.

> `azd ai agent init` initializes both the azd project and its environment. Run it directly in the target directory. For an existing Foundry project, also pass `--project-id <arm-id>`.

When creating a new agent in an existing Foundry project, verify that the selected Foundry model deployment exists by running:

```bash
az cognitiveservices account deployment list \
  --resource-group "<rg-name>" \
  --name "<foundry-account-name>" \
  --output table
```

### Step 3 -- Choose the starting point

| User has ... | Use |
|--------------|-----|
| Empty workspace, or wants a starter | **New agent** -- Step 4a |
| Existing agent project or source code | **Existing agent** -- Step 4b |

If unsure, inspect the workspace and user intent. Do not invent a manifest URL or repository path.

### Step 4a -- New agent: scaffold from a sample

Follow [azd Sample Selection Guidance](create-hosted--quick-reference-when-to-use-this-skill-hosted-vs-prompt.md#azd-sample-selection-guidance) and use the captured `manifestUrl` to scaffold the agent.

Run `azd ai agent init`. `azd ai agent init` is sufficient to create new Foundry projects (or reuse an existing one) and create new Foundry agents. By default, you do not need to run `azd init` unless the user has specific initialization requirements.

Python example (add `--project-id "<resourceId>"` for an existing Foundry project):

Pass `--deploy-mode code` for code deploy (recommended), or `--deploy-mode container` for container deploy.

```bash
azd ai agent init --no-prompt \
  -m "<manifestUrl>" \
  --deploy-mode code \
  --runtime python_3_13 \
  --entry-point main.py \
  --agent-name "<agent-name>"
```

After the `azd ai agent init` completes, go to the project folder and set the collected subscription and location on the active azd environment:

```bash
azd env set AZURE_SUBSCRIPTION_ID "<subscription-id>"
azd env set AZURE_LOCATION "<region>"
```

When creating a new Foundry project, also set its name before provisioning:

```bash
azd env set AZURE_AI_PROJECT_NAME "<project-name>"
```

> `--agent-name` at init sets both the `azure.yaml` service key and its `name:` in one shot; renaming after init requires editing both in `azure.yaml`.

Do not run `azd env new`, `azd env select`, or `azd env set` before `azd ai agent init` in a new temp/workspace; there is no azd project yet, so those commands fail and waste time. Do not chain `azd env set` after `azd ai agent init` on the same command line. The init command may scaffold the project into a subfolder, so run `azd env set` only after initialization completes and after changing to the scaffolded project directory. For an existing project, `--project-id` is enough during init. Set endpoint/model values immediately after init, once `azure.yaml` and the azd env exist.

> Tip: if the manifest declares a `parameters:` block (check by `curl <manifestUrl>`), collect required values before init when an azd project already exists. In a new empty workspace, prefer a sample without required secrets; there is no azd env to set until init creates the project files.

`init` writes `azure.yaml` (or appends the agent service to it), the agent source under `src/<agent-name>/`, and `<service-dir>/.agentignore`. A successful code deploy init produces an `azure.yaml` service block (`host: azure.ai.agent`) with `codeConfiguration:`. For file shapes, see [azd-ai-cli](../azd-guidance/references/azd-ai-cli.md).

#### Model deployments (azd Golden Path)

Read [Foundry Model Reference](./references/foundry-model.md) and follow the steps in it when you want to query model related data.

`azure.yaml services.ai-project.deployments[]` is the **single source of truth** for model deployments in azd-managed Foundry projects. Model deployments live under the dedicated `ai-project` service (`host: azure.ai.project`); the agent service links to it via `uses: [ai-project]` and references the model through its `environmentVariables`. The flow is:

```
manifest → azd ai agent init → azure.yaml ai-project deployments[] → AI_PROJECT_DEPLOYMENTS env (internal) → Bicep → Microsoft.CognitiveServices/accounts/deployments
```

Rules:

- **`azd ai agent init` writes `services.ai-project.deployments[]` from the sample's manifest** and also sets `AZURE_AI_MODEL_DEPLOYMENT_NAME` to the first deployment's `name`. `azd provision` then creates the deployment through Bicep. No `az` calls are needed in the Golden Path.
- **`deployments[].name` is the literal Azure deployment resource name** — not a label, not a placeholder. Use a human-readable model name (e.g. `gpt-4o-mini`, `gpt-4.1-mini`). **Never** use the literal string `AZURE_AI_MODEL_DEPLOYMENT_NAME` as the `name` value; doing so creates a deployment literally named `AZURE_AI_MODEL_DEPLOYMENT_NAME` and the agent will 404 on its first invoke.
