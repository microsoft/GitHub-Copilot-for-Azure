# Deploy a Foundry Agent

Provision Azure resources when needed, deploy the agent, and smoke-test it.

For **hosted agents** (custom container or code), use `azd deploy`. Prefer **direct code deployment through azd** (no Docker/ACR required): `agent.yaml` must contain `code_configuration:`, so `azd deploy` will use direct code deployment and zip the source and let Foundry build it. Use container/ACR deployment only when the agent truly needs a Dockerfile, custom system packages, or a pre-built image.

For **prompt agents** (LLM + instructions, no custom code), use the Foundry MCP `agent_update` tool.

## Quick Reference

| Property | Value |
|----------|-------|
| Hosted (recommended) | `azd provision` when needed, direct code deployment via `azd deploy` (`code_configuration` present), `azd ai agent invoke` |
| Hosted (container) | `azd provision` when needed, container/ACR deployment via `azd deploy` (requires Docker/Podman + ACR, no `code_configuration:` in agent.yaml) |
| Prompt MCP | `agent_definition_schema_get`, `agent_update`, `agent_get`, `agent_delete` |
| Versioning | Each successful `azd deploy` creates an immutable agent version |
| Endpoint-only patch | `azd ai agent endpoint update` (no new version) |
| Local dev | [create-hosted](../create/create-hosted.md), [local-run](../create/references/local-run.md) |

## Hosted vs Prompt

- Shipping Python / .NET / Node code -> **Hosted** (azd workflow below).
- Updating only model / instructions / tools -> **Prompt** (MCP workflow below).

## Deployment Method Selection -- Hosted agents

Before running `azd deploy`, inspect `<service-dir>/agent.yaml`.

| Agent YAML state | Deployment path |
|------------------|-----------------|
| `code_configuration:` present | **Direct code deploy** through `azd deploy`; no Docker/ACR build. |
| No `code_configuration:` | **Container/ACR deploy** through `azd deploy`; builds/pushes an image or uses a pre-built `image:`. |

`code_configuration:` example in agent.yaml:

```yaml
code_configuration:
  runtime: python_3_13
  entry_point: main.py
  dependency_resolution: remote_build
```

Default to direct code for standard hosted-agent code. If `azd deploy` prints `Packaging container` for an agent that does not need container-specific behavior, add or fix `code_configuration` and retry. Use the container path when the agent depends on Dockerfile behavior, system packages, or a pre-built image.

## Workflow -- Hosted agent (azd)

> Prerequisite: project scaffolded with `azd ai agent init`. If not, start at [create-hosted](../create/create-hosted.md).

### Step 1 -- Resolve azd environment

If the user provided an existing project endpoint, project ARM ID, or model deployment, set those values before deploy. Then verify the azd environment with `azd env get-values`.

```bash
azd env set AZURE_AI_PROJECT_ENDPOINT "<project-endpoint>"
azd env set AZURE_AI_PROJECT_ID "<project-arm-id>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model-deployment-name>"
azd env get-values
```

Run:

```bash
azd ai project show --output json
azd ai agent show --output json
```

Branch on output: `not_deployed` -> Step 2. `active` / `deployed` -> redeploy (skip Step 2, go to Step 3). If `azd ai project show` fails with `missing_project_endpoint`, do Step 2 first -- `azd provision` will create the project.

> **Important:** Before deploy, also make sure `agent.yaml` and the azd environment are aligned with the user's provided configuration values.

### Step 2 -- Provision Azure resources (one-time per env)

Skip `azd provision` when the user gave you an existing `AZURE_AI_PROJECT_ENDPOINT` or `FOUNDRY_PROJECT_ENDPOINT` and the workflow only needs to deploy the agent into that project.

Run provision only for new projects or real infrastructure changes:

```bash
azd provision --no-prompt
```

> Optional: run `azd provision --preview --no-prompt` first to preview the resource changes (a what-if) before applying them.

What this does:

- Creates the Foundry project (if not present) and supporting resources under `infra/`.
- Creates project connections declared in `azure.yaml services.<name>.config.connections[]`. `${PARAM_*}` placeholders resolve from the active azd env.
- Wires model deployments, AI Search, ACR, etc. `infra/layers/` provision in parallel when present.

This is a core `azd` command. Skip provision when the user gave you an existing `AZURE_AI_PROJECT_ENDPOINT` via `azd env set` -- the extension uses the existing project as-is.


### Step 3 -- Deploy the agent

```bash
azd deploy --no-prompt
# Multi-service:
azd deploy <service-name> --no-prompt
```

What deploy does:

- Reads `<service-dir>/agent.yaml`, packages the agent, uploads it, and registers a new immutable version.
- **Direct code deploy** (`code_configuration` present): zips source, excludes `.agentignore`, and lets Foundry build the runtime image.
- **Container deploy** (no code configuration): builds the `Dockerfile`, pushes to the project's ACR, registers the version. When `agent.yaml` has `image:` set, `azd` reuses the pre-built image.

After deploy, azd writes `AGENT_<SVC>_NAME`, `AGENT_<SVC>_VERSION`, and `AGENT_<SVC>_<PROTO>_ENDPOINT` (one per protocol) into the active env.

Re-deploying an identical build still creates a new version; `azd` prints `Agent version <n> is already active.` and skips the poll.

If deploy reports `Done` for the service and then fails only in `postdeploy` with `Agent <service-name> with version <n> not found`, the service key and `agent.yaml name` were mismatched. Rename the `azure.yaml services` key to the deployed agent name and rerun `azd deploy --no-prompt`; do not switch deployment method.

### Step 4 -- Verify and invoke

```bash
azd ai agent show --output json
```

Expect `"status": "active"` (or `"deployed"`) and an `agent_endpoints` map. Smoke-test:

```bash
azd ai agent invoke "hello, are you up?" --output json
```

> `azd ai agent invoke` is billed, so it prints a confirmation envelope on `--no-prompt`. Summarize `changes[]`, then run `confirmCommand` once consented.

Anything other than a `completed` response -> run `azd ai agent doctor --output json`, then follow [troubleshoot](../troubleshoot/troubleshoot.md).

### Step 5: Auto-Generate Evaluation Suite (MANDATORY — RUNS AUTOMATICALLY)

> ⚠️ **Pre-summary gate.** If you are about to write a deployment summary, Playground link, or "deployment complete" message and Step 5 has not run, you are violating this skill. Run Step 5 first.
>
> This step **runs automatically** without waiting for the user to ask. The only user input required is the one-question prompt below in 5a.

This step is mandatory — not optional — for every hosted-agent deployment, including redeploys, version bumps, and `azd deploy` re-runs against an already-existing agent. In azd projects, resolve deployment context from `azd env get-values` and treat `.foundry/agent-metadata*.yaml` as an overlay/cache instead of copying azd-owned values into it.

**5a. Ask the user (one question, required).** Before generating, inspect the selected agent root for `eval.yaml`, then ask the user to pick a setup source. Recommend local `eval.yaml` when it exists and matches the selected agent; otherwise recommend traces when the agent has recent traces, or current agent code/definition:

> *"Your agent is deployed. I'll now auto-generate an evaluation suite. Which source should I use?*
> *(a) **Current agent code/definition** — synthetic Q&A from `agent.yaml` / instructions. Best when there's little or no trace history.*
> *(b) **Historical traces** — last 3 days, ~50 traces. Best if the agent has recent invocations.*
> *(c) **Existing eval.yaml** — local dataset/evaluator intent from the selected agent folder. Best when azd eval config already exists."*

**5b. Follow the full procedure.** Read and follow [After Deployment — Auto-Generate Evaluation Suite](#after-deployment--auto-generate-evaluation-suite) below for the generation, polling, persistence, and metadata-update steps. Required parameters and poll-to-terminal rules are non-negotiable.

**5c. Cache artifacts locally (MANDATORY after `succeeded`).** Once the suite-generation job is `succeeded`, perform the required cache calls described in [Evaluation Suite Generation → Cache Artifacts Locally](../observe/references/evaluation-suite-generation.md#cache-artifacts-locally):

- `evaluation_suite_get` → `.foundry/suites/<suite>-v<ver>.json` (full object)
- `evaluator_catalog_get` → `.foundry/evaluators/<eval>-v<ver>.json` (full definition, NOT a stub)
- `evaluation_dataset_get` + `evaluation_dataset_sas_url_get` → `.foundry/datasets/<agent>-<dataset>-v<ver>.ref.json` (metadata stub) AND `.foundry/datasets/<dataset>-v<ver>/<blob>` (actual JSONL rows). The SAS-url tool returns a container-scope SAS — list the container then `curl.exe` each blob. See the reference for the exact list+download steps. Set `contentDownloaded: true` in the stub once files are on disk.

Do not write the deployment summary until all cache files exist.

**5d. Skip-only-on-explicit-request.** If — and only if — the user explicitly says "skip eval suite generation," record that decision in your summary and still ensure deployment context remains resolvable from azd or metadata. "The user didn't ask for it" is **not** a valid reason to skip; this step is opt-out, not opt-in.

### Step 6 -- Hand off

- Send more messages -> [invoke](../invoke/invoke.md)
- Evaluate / optimize -> [observe](../observe/observe.md)
- Diagnose failures -> [troubleshoot](../troubleshoot/troubleshoot.md)
- Search traces / latency -> [trace](../trace/trace.md)

## `.agentignore`

`azd ai agent init` writes a default `<service-dir>/.agentignore` for code-deploy projects (gitignore syntax) that excludes tooling files, secrets, language artifacts, and Docker files from the deploy ZIP. Only the root file is read; use `!path` to force-include.

## Endpoint or card edits -- no new version

When only `agentEndpoint:` or `agentCard:` changed in `agent.yaml`:

```bash
azd ai agent endpoint update --dry-run # preview
azd ai agent endpoint update --force # apply
```

Idempotent.

## Multi-environment deploys

```bash
azd env list
azd env select prod
azd deploy --no-prompt
```

Each env has its own `AGENT_<SVC>_*` vars.

## Common failure modes -- Hosted

| Error | Fix |
|-------|-----|
| `missing_project_endpoint` | Run `azd env set AZURE_AI_PROJECT_ENDPOINT <url>`, or run `azd provision` for a new project. |
| `invalid_agent_manifest` | `azd ai agent doctor`; fix the named field. |
| `invalid_connection` | Inspect with `azd ai agent connection show <name>`. |
| Docker daemon not running | You are on the container path. Add/fix `code_configuration` and retry direct code deploy. Only install Docker or try remote image build if you specifically need container deploy. |
| ACR push 403 | Foundry project RBAC is missing `AcrPush` for your identity. Consider switching to direct code deployment to avoid ACR entirely. |
| `container registry endpoint not found` | ACR is not configured. Use `azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT <url>`, or switch to direct code deployment. |
| Agent version poll times out | Build still running; retry `azd ai agent show` after a minute. |
| `session_not_ready` (424) | Cold start or readiness delay. Wait 15-30 seconds and retry. If persistent, use `1` CPU / `2Gi` memory minimum, verify the model deployment name, capability host, and agent identity role. |
| `invalid value "json" for --output` from `azd ai agent invoke` | Invoke supports only `default` and `raw` currently. Retry without `--output json`. |
| `could not resolve agent service in azd project: no azure.ai.agent service named '<agentName>' found in azure.yaml` from `azd ai agent invoke` | Name mismatch. Use the service name, update `agent.yaml`, or invoke through the Foundry MCP `agent_invoke` tool. |
| `subscription quota exceeded` | Ask user to request quota; do not auto-retry. |
| Bicep deploy errors | Forward `error.details[]` verbatim to the user. |
| `RoleAssignmentUpdateNotPermitted` during provision | A role assignment already exists but conflicts. Check for existing role assignments with `az role assignment list --scope <resource-scope>`. The provision may have succeeded for all resources except RBAC — verify with `azd ai project show` and manually assign the `Cognitive Services User` role to the agent identity if needed. |

For deeper logs, see [troubleshoot](../troubleshoot/troubleshoot.md).

## Workflow -- Prompt agent (MCP)

Prompt agents are not containerized -- they are a model + instructions + optional tools, created through the Foundry MCP server. Use when the user explicitly wants a prompt agent.

### MCP tools

| Tool | Purpose |
|------|---------|
| `agent_definition_schema_get` | Get the schema (`schemaType: "prompt"`). |
| `agent_update` | Create or update; supports `isCloneRequest` + `cloneTargetAgentName`. |
| `agent_get` | List or fetch one. |
| `agent_delete` | Delete an agent. |

### Steps

1. **Collect config** -- resolve endpoint from `azd env get-values` or ask. Then ask for **agent name**, **model deployment** (e.g. `gpt-4o`), and optional **instructions**, **temperature**, **tools**.
2. **Get schema** -- `agent_definition_schema_get` with `schemaType: "prompt"`.
3. **Create** -- `agent_update` with `{"kind": "prompt", "model": "<deployment>", "instructions": "...", "temperature": 0.7}`.
4. **Smoke test** -- follow [invoke](../invoke/invoke.md).
5. **Auto-generate evaluation suite** -- see [Step 5: Auto-Generate Evaluation Suite (Prompt)](#step-5-auto-generate-evaluation-suite-prompt-mandatory--runs-automatically) below.
6. **Hand off** -- evaluate via [observe](../observe/observe.md); clone via `agent_update` + `isCloneRequest`; delete via `agent_delete`.

### Step 5: Auto-Generate Evaluation Suite (Prompt) (MANDATORY — RUNS AUTOMATICALLY)

> ⚠️ **Pre-summary gate.** If you are about to write a deployment summary or Playground link and Step 5 has not run, you are violating this skill. Run Step 5 first.
>
> This step **runs automatically** without waiting for the user to ask. The only user input required is the one-question prompt below.

**5a. Ask the user (one question, required).** Before generating, inspect the selected agent root for `eval.yaml`, then ask which setup source to use. Recommend local `eval.yaml` when it exists and matches the selected agent; otherwise recommend recent traces when present, or current agent code/definition:

> *"Your agent is deployed. I'll now auto-generate an evaluation suite. Which source should I use? (a) Current agent code/definition (synthetic Q&A), (b) Historical traces (last 3 days, ~50 traces), or (c) Existing eval.yaml from the selected agent folder?"*

**5b. Follow the full procedure.** Read and follow [After Deployment — Auto-Generate Evaluation Suite](#after-deployment--auto-generate-evaluation-suite) below.

**5c. Cache artifacts locally (MANDATORY after `succeeded`).** Once the suite-generation job is `succeeded`, perform the required cache calls described in [Evaluation Suite Generation → Cache Artifacts Locally](../observe/references/evaluation-suite-generation.md#cache-artifacts-locally): suite JSON, evaluator full definition, dataset `.ref.json` PLUS the actual dataset blobs downloaded via `evaluation_dataset_sas_url_get` (container SAS → list → curl each blob). Do not write the deployment summary until those files exist.

**5d. Skip-only-on-explicit-request.** Skip only if the user explicitly says "skip eval suite generation." Keep deployment context resolvable from azd or metadata. "The user didn't ask for it" is **not** a valid reason to skip.

## Common failure modes -- Prompt

| Error | Fix |
|-------|-----|
| Schema fetch failed | Verify endpoint format: `https://<resource>.services.ai.azure.com/api/projects/<project>`. |
| Agent creation failed | Use `agent_definition_schema_get` to verify the definition. |
| Permission denied | User needs `Foundry User` role on the project. |
| Model not found | Deploy the model first via [models/deploy-model](../../models/deploy-model/SKILL.md). |

## Display agent details (both flows)

After a successful deploy, show the agent's name, version, status, and endpoints in a table. Include a Playground link:

```
https://ai.azure.com/nextgen/r/{encodedSubId},{resourceGroup},,{accountName},{projectName}/build/agents/{agentName}/build?version={agentVersion}
```

`encodedSubId` is the subscription GUID as URL-safe base64 (no `=`):

```bash
python -c "import base64,uuid;print(base64.urlsafe_b64encode(uuid.UUID('<SUBSCRIPTION_ID>').bytes).rstrip(b'=').decode())"
```

For hosted agents, `playground_url` is in `azd ai agent show --output json`.

## After Deployment — Auto-Generate Evaluation Suite

> ⚠️ **This step is automatic.** After a successful deployment, immediately prepare the selected `.foundry` environment for evaluation without waiting for the user to request it. This matches the eval-driven optimization loop.

### 1. Resolve Effective Context

Use the [Common Project Context Resolution](../../SKILL.md#agent-common-project-context-resolution) flow. In azd projects, resolve project endpoint, agent name/version, ACR, and observability from `azd env get-values`; use `.foundry/agent-metadata*.yaml` only for overlays and synced suite/cache refs. If `eval.yaml` exists in the selected agent root, parse it as local evaluation intent before generating anything new.

### 2. Read Agent Instructions

Use **`agent_get`** (or local `agent.yaml`) to understand the agent's purpose and capabilities.

### 3. Reuse or Refresh Suite Cache

Inspect the selected agent root before generating anything new:

- Reuse a selected environment `evaluationSuites[]` entry when it has `suiteName`, `suiteVersion`, matching `.foundry/datasets/`, and matching `.foundry/evaluators/` cache files.
- When `eval.yaml` exists and matches the selected agent, prefer verifying/registering its dataset and evaluator references before creating a brand-new generated suite.
- Call `evaluation_suite_get` to confirm the remote suite still exists before reusing it.
- Ask before refreshing cached files, replacing thresholds, or writing a new suite version.
- If cache or the remote suite is missing/stale, generate a new suite and update metadata for the active environment only.

### 4. Identify Generation Deployment

Use **`model_deployment_get`** to list the selected project's actual model deployments, then choose one that supports chat completions for quality evaluators. Do **not** assume `gpt-4o` exists in the project. If no deployment supports chat completions, stop the auto-setup flow and tell the user quality evaluators cannot run until a compatible judge deployment is available.

### 5. Generate Evaluation Suite

Read and follow [Evaluation Suite Generation](../observe/references/evaluation-suite-generation.md) for source selection, required parameters, polling, and cache writes. In the deploy flow, keep these guardrails:

- Ask the user which setup source to use before calling `evaluation_suite_generation_job_create`; recommend matching `eval.yaml` when present, then recent traces when available, otherwise the current agent code/definition.
- Use the chat-capable generation deployment selected above and honor the reference's service constraints, especially `maxSamples` (15-1000) and `agentSourceNames: [<agentName>]` for agent-sourced suites.
- Do not report deployment complete while the generation job is `in_progress`; poll with `evaluation_suite_generation_job_get` until `succeeded`, `failed`, or `canceled`, then inspect the suite with `evaluation_suite_get` and cache artifacts as described in the reference.

### 6. Fallback to Manual Suggestions

If `evaluation_suite_generation_job_create`, `evaluation_suite_generation_job_get`, or `evaluation_suite_get` fails, is unavailable, or returns incomplete artifacts, fall back to the previous manual flow:

1. Call `evaluator_catalog_get` and suggest relevant built-in/custom evaluators.
2. Read [Generate Seed Evaluation Dataset](../eval-datasets/references/generate-seed-dataset.md), generate valid local JSONL with `query` and `expected_behavior`, and register it with `evaluation_dataset_create`.
3. Persist the suite with `generationSource: manual-fallback` and include the fallback reason in the workflow summary.

Do **not** silently ignore generation failures; the user should know whether setup used the generated-suite path or the fallback path.

The local filename must start with the effective selected Foundry agent name before adding stage, environment, or version suffixes.

### 7. Persist Artifacts and Evaluation Suites

Save generated or fallback evaluator definitions, local datasets, and evaluation outputs under `.foundry/` using the cache paths defined in [Evaluation Suite Generation](../observe/references/evaluation-suite-generation.md), then register or update evaluation suites in the selected metadata file for the selected environment:

```text
.foundry/
  agent-metadata.yaml
  agent-metadata.prod.yaml
  suites/
    <suite-name>-v<version>.json
  evaluators/
    <evaluator-name>-v<version>.json
  datasets/
    <agent-name>-<dataset-name>-v<version>.ref.json
    <dataset-name>-v<version>/<blob>
  results/
```

Each evaluation suite should bundle the remote suite reference, local cache paths, thresholds, and a `tags` map (for example, `tier: smoke`, `purpose: baseline`, `stage: generated`). Persist `suiteName`, `suiteVersion`, `generationJobId`, `generationSource`, `datasetFile`, and `datasetUri` together. Do not persist azd-owned deployment fields when azd resolves them. If the selected environment still uses older `testSuites[]` or legacy `testCases[]`, replace that list with `evaluationSuites[]` in the rewritten metadata and map legacy `priority` to `tags.tier` only when `tags.tier` is missing.

### 8. Prompt User

*"Your agent is deployed and running in the selected environment. The `.foundry` cache now contains generated evaluation-suite metadata, local dataset/evaluator references, and remote Foundry suite references. Would you like to run an evaluation to identify optimization opportunities?"*

- **Yes** → follow the [observe skill](../observe/observe.md) starting at **Step 2 (Evaluate)** — cache and metadata are already prepared.
- **No** → stop. The user can return later.
- **Production trace analysis** → follow the [trace skill](../trace/trace.md) to search conversations, diagnose failures, and analyze latency using App Insights.

## Non-Interactive / YOLO Mode

- Hosted: always pass `--no-prompt`. If `azd ai agent invoke` prints a `confirmation_required` envelope, summarize `changes[]` and re-run with `--force` after the user consents -- never auto-append `--force`.
- Prompt: all required values (project endpoint, agent name, model deployment) must come from the user message or `azd env get-values`; missing values should fail loudly rather than prompt.
