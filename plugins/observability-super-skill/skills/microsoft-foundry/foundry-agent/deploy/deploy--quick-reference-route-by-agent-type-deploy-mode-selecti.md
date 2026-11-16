# Selected guidance: Quick Reference; Route by Agent Type; Deploy Mode Selection -- Hosted agents; Workflow -- Hosted agent (azd); Step 1 -- Resolve azd environm

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

# Deploy a Foundry Agent

Provision Azure resources when needed, deploy the agent, and smoke-test it.
For **hosted agents** (custom container or code), use `azd deploy`.
For **Voice Agents**, use `azd deploy` and smoke-test over the `voice` WebSocket endpoint.
For **Managed Harness Agents** (`kind: prompt` plus the Copilot harness), use `azd deploy`.
For **ordinary prompt agents**, use the Foundry MCP `agent_update` tool.

## Quick Reference

| Property | Value |
|----------|-------|
| Hosted (recommended) | `azd provision` when needed, code deploy via `azd deploy` (`codeConfiguration` present), then verify and invoke |
| Hosted (container) | `azd provision` when needed, container deploy via `azd deploy` (remote builds require a Dockerfile and ACR; local builds also require Docker; no `codeConfiguration:` in the `azure.yaml` service block) |
| Voice (Prompt Voice) | `azd provision` when needed, declarative `azd deploy`, then verify over the `voice` WebSocket endpoint (`azd ai agent invoke` is not supported) |
| Voice (Hosted Voice) | `azd provision` when needed, `azd deploy` for both the `kind: hosted` target and `kind: voice` wrapper, report both versions separately, and smoke-test the wrapper over the `voice` WebSocket endpoint |
| Managed Harness Agent | `azd provision` when needed, then declarative `azd deploy`; no code/container packaging |
| Prompt MCP | `agent_definition_schema_get`, `agent_update`, `agent_get`, `agent_delete` |
| Versioning | Each successful `azd deploy` creates an immutable agent version |
| Endpoint-only patch | `azd ai agent endpoint update` (no new version) |
| Local dev | [create-hosted](../create/create-hosted.md), [create-voice](../create/create-voice.md), [local-run](../create/references/local-run.md) |

## Route by Agent Type

- Voice Agent (single-agent Prompt Voice or two-agent Hosted Voice wrapper + `kind: hosted` target) -> **Voice** (azd Voice workflow below).
- Shipping Python / .NET code (`kind: hosted`) -> **Hosted** (azd workflow below).
- Explicit `kind: prompt` plus `harness.type: microsoft_copilot_preview` or legacy `github_copilot_preview` -> **Managed Harness Agent** (azd workflow below).
- Ordinary Prompt Agent model / instructions / tools -> **Prompt** (MCP workflow below).

## Deploy Mode Selection -- Hosted agents

Follow the user's explicit deploy mode preference or the existing project configuration. Otherwise, use **code deploy through azd** by default (no Docker/ACR required): the agent's `azure.yaml` service block must contain `codeConfiguration:`, so `azd deploy` will zip the source and let Foundry build it. If `azd deploy` prints `Packaging container` for an agent that does not need container-specific behavior, add or fix `codeConfiguration` and retry.

When the agent depends on Dockerfile behavior, system packages, or a pre-built image, or when the user explicitly asks to build or deploy a container image, mentions Container/Docker Image/Azure Container Registry (ACR), or supplies a pre-built image, use container deploy.

Before running `azd deploy`, inspect the agent's service block in `azure.yaml`.

| Service block state | Deployment path |
|------------------|-----------------|
| `codeConfiguration:` present | **Code deploy** through `azd deploy`; no Docker/ACR build. |
| No `codeConfiguration:` with `language: docker` | **Container deploy** through `azd deploy`. |

`codeConfiguration:` example in the `azure.yaml` service block:

```yaml
services:
  <agent-name>:
    host: azure.ai.agent
    codeConfiguration:
      runtime: python_3_13
      entryPoint: main.py
      dependencyResolution: remote_build
```

Remote ACR build example in the `azure.yaml` service block:

```yaml
services:
  <agent-name>:
    host: azure.ai.agent
    language: docker
    docker:
      remoteBuild: true
```

## Workflow -- Hosted agent (azd)

> Prerequisite: project scaffolded with `azd ai agent init`. If not, start at [create-hosted](../create/create-hosted.md).

### Step 1 -- Resolve azd environment

If the user provided an existing project endpoint, project ARM ID, or model deployment, set those values before deploy:

```bash
azd env set AZURE_AI_PROJECT_ENDPOINT "<project-endpoint>"
azd env set AZURE_AI_PROJECT_ID "<project-arm-id>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model-deployment-name>"
```

If using container deploy and the user provided an existing ACR, set:

```bash
azd env set AZURE_CONTAINER_REGISTRY_NAME "<acr-name>"
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT "<acr-login-server>"
azd env set AZURE_CONTAINER_REGISTRY_RESOURCE_ID "<acr-resource-id>"
```

Verify the azd environment with `azd env get-values`.

Run:

```bash
azd ai project show --output json
azd ai agent show --output json
```

Branch on output: `not_deployed` -> Step 2. `active` / `deployed` -> redeploy (skip Step 2, go to Step 3). If `azd ai project show` fails with `missing_project_endpoint`, do Step 2 first -- `azd provision` will create the project.

> **Important:** Before deploy, also make sure the agent's `azure.yaml` service block and the azd environment are aligned with the user's provided configuration values.

### Step 2 -- Provision Azure resources (one-time per env)

> 🚦 **Project-selection gate.** If no foundry project endpoint is configured (not in the message, `azd env`, or `.env`) and the user hasn't asked to create one, stop and ask them to pick an existing foundry project or confirm creating a new one — don't silently select.

Skip `azd provision` when the user gave you an existing `AZURE_AI_PROJECT_ENDPOINT` or `FOUNDRY_PROJECT_ENDPOINT` and no infrastructure changes are needed. If container deploy needs a new ACR, run `azd provision` even when using an existing Foundry project.

Run provision only for new projects or real infrastructure changes:

```bash
azd provision --no-prompt
```

> Optional: run `azd provision --preview --no-prompt` first to preview the resource changes (a what-if) before applying them.
>
> Optional: add `--no-state` on a fresh azd environment to skip the existing-deployment check and provision faster; omit it when re-provisioning an existing one.

What this does:

- Creates the Foundry project (if not present) and supporting resources under `infra/`.
- Creates connections declared as top-level `azure.ai.connection` services. `${PARAM_*}` placeholders resolve from the active azd env.
- Wires model deployments, AI Search, ACR, etc. `infra/layers/` provision in parallel when present.

After provision completes for a new project, run `azd env get-values` and set missing required azd env values, especially `AZURE_AI_PROJECT_ID` and `AZURE_TENANT_ID`, before local run or the first `azd deploy`.

### Step 3 -- Pre-deployment check

Branch by deploy mode.

#### Code deploy

Run `azd env get-values` and verify that these values are set for the intended
environment:

- `AZURE_AI_PROJECT_ENDPOINT`
- `AZURE_AI_PROJECT_ID`
- `AZURE_AI_MODEL_DEPLOYMENT_NAME`
- `AZURE_TENANT_ID`

For Python, verify that `<service-dir>/.agentignore` excludes `.venv/`, adding the rule if missing.

#### Container deploy

Complete the [Container Deploy Precheck](references/container-deploy.md)
before continuing.

### Step 4 -- Deploy the agent

> **Private package index:** If `azd deploy` fails and the user's `uv.lock` points to a private Python package index, the Foundry service might be unable to access the index when installing dependencies. Guide the user to regenerate `uv.lock` using the public PyPI index, or export the locked dependencies to a `requirements.txt` file with pinned versions, and then retry the deployment.

```bash
azd deploy --no-prompt
# Multi-service:
azd deploy <service-name> --no-prompt
```

What deploy does:

- Reads the agent's `azure.yaml` service block, packages the agent, uploads it, and registers a new immutable version.
- **Code deploy** (`codeConfiguration` present): zips source, excludes `.agentignore`, and lets Foundry build the runtime image.
- **Container deploy** (no code configuration): builds the `Dockerfile`, pushes to the project's ACR, registers the version. When the service block has `image:` set, `azd` reuses the pre-built image.

After deploy, azd writes `AGENT_<SVC>_NAME`, `AGENT_<SVC>_VERSION`, and `AGENT_<SVC>_<PROTO>_ENDPOINT` (one per protocol) into the active env.

For agents with Activity protocol, `azd deploy` also generates `<service-dir>/TEAMS_APP_SETUP.md`; read it and explain the remaining post-deployment steps to the user.

Re-deploying an identical build still creates a new version; `azd` prints `Agent version <n> is already active.` and skips the poll.

If deploy reports `Done` for the service and then fails only in `postdeploy` with `Agent <service-name> with version <n> not found`, the `azure.yaml` service key and the service's `name:` were mismatched. Rename the `azure.yaml services` key to the deployed agent name and rerun `azd deploy --no-prompt`; do not switch deploy mode.

### Step 5 -- Verify and invoke

```bash
azd ai agent show --output json
```

Expect `"status": "active"` (or `"deployed"`) and an `agent_endpoints` map. Inspect the selected service protocols in `azure.yaml`, then smoke-test:

For the Responses or Invocations protocol, smoke-test with azd:

```bash
azd ai agent invoke "hello, are you up?"
```

For a multi-protocol service, pass `--protocol` explicitly.

> Remote invocation can incur model usage charges. Run it only as part of the requested deployment or test.

For the Activity protocol, `azd ai agent invoke` won't work; follow [invoke](../invoke/invoke.md) to invoke the agent.

Run one remote invocation only unless the user explicitly asked to test multi-turn/session behavior. A single successful response is enough for the deployment smoke test. Anything other than a completed/successful response -> run `azd ai agent doctor --output json`, then follow [troubleshoot](../troubleshoot/troubleshoot.md).

### Step 6: Auto-Generate Evaluation Suite (MANDATORY — RUNS AUTOMATICALLY)

> ⚠️ **Pre-summary gate.** If you are about to write a deployment summary or Playground link and Step 6 has not run, you are violating this skill. Run Step 6 first.

This step runs automatically after deploy. Ask the user which source to use and start it right after deploy succeeds — with `--no-wait`, `generate` returns in seconds and generation runs server-side, so it overlaps with invoke/test steps and finishes faster overall.

> *"Your agent is deployed. Want me to set up an evaluation suite now? (a) Yes — current agent instructions (synthetic Q&A), (b) Yes — historical traces (last 3 days), (c) Yes — use existing `eval.yaml`, (d) No / later."*

| Choice | Command | What's next |
|---|---|---|
| (a) Agent instructions | `azd ai agent eval generate --gen-instruction "<agent purpose>" --no-wait --no-prompt` — `--gen-instruction` is required (hosted agents don't auto-derive it); use the service's `description:` in `azure.yaml`. | Generation runs server-side. Tell the user: *"Suite submitted. Run `azd ai agent eval run` whenever you're ready — it'll finalize `eval.yaml` and execute the eval in one step."* |
| (b) Historical traces | `azd ai agent eval generate --trace-days 3 --max-samples 50 --no-wait --no-prompt` | Same as (a). |
| (c) Existing `eval.yaml` | Skip `generate`. | Tell the user: *"Using existing `eval.yaml`. Run `azd ai agent eval run` when ready."* |
| (d) No / later | Skip. | Tell the user: *"You can run `azd ai agent eval generate` (and then `eval run`) anytime."* |

Other useful flags on `generate`: `--dataset <path-or-name>` to reuse an existing dataset instead of generating one, `--evaluator <name>` (repeatable) to pin built-in or custom evaluators, `--eval-model <name>` to choose the model used for generation and evaluation, `--reset-defaults` to overwrite an existing eval config, `--name <suite-name>` and `--out-file <path>` (default `eval.yaml`).

Then proceed to Step 7. See [After Deployment — Auto-Generate Evaluation Suite](deploy--common-failure-modes-prompt-display-agent-details-after.md#after-deployment--auto-generate-evaluation-suite) for run/refresh details. Run `azd ai agent eval run` only after the user explicitly agrees.

### Step 7 -- Hand off

- Send more messages -> [invoke](../invoke/invoke.md)
- Evaluate / optimize -> [observe](../observe/observe.md)
- Diagnose failures -> [troubleshoot](../troubleshoot/troubleshoot.md)
- Search traces / latency -> [trace](../trace/trace.md)

