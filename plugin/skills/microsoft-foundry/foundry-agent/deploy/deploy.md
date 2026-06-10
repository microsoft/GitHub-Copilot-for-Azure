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

After provision completes for a new project, run `azd env get-values` and set missing required azd env values, especially `AZURE_AI_PROJECT_ID` and `AZURE_TENANT_ID`, before local run or the first `azd deploy`.

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
azd ai agent invoke "hello, are you up?"
```

> `azd ai agent invoke` is billed, so it prints a confirmation envelope on `--no-prompt`. Summarize `changes[]`, then run `confirmCommand` once consented.

Run one remote invocation only unless the user explicitly asked to test multi-turn/session behavior. A single successful response is enough for the deployment smoke test. Anything other than a completed/successful response -> run `azd ai agent doctor --output json`, then follow [troubleshoot](../troubleshoot/troubleshoot.md).

### Step 5: Auto-Generate Evaluation Suite (MANDATORY — RUNS AUTOMATICALLY)

Ask the user (one question) which source to use, then start `azd ai agent eval init` **in a background terminal** using your environment's async execution mechanism. `init` typically takes several minutes; do not block the deployment summary on its completion. See [After Deployment — Auto-Generate Evaluation Suite](#after-deployment--auto-generate-evaluation-suite) below for the full procedure (startup verification, error classification, and later-turn notification).

> *"Your agent is deployed. I'll now auto-generate an evaluation suite. Which source should I use? (a) Current agent instructions (synthetic Q&A), (b) Historical traces (last 3 days), or (c) Existing dataset/evaluators (skip init, run with current `eval.yaml`)."*

| Choice | Command |
|---|---|
| (a) Agent instructions | `azd ai agent eval init --gen-instruction "<agent purpose>" --no-prompt` — `--gen-instruction` is required (hosted agents do not auto-derive it); derive the value from `agent.yaml` `description:`. |
| (b) Historical traces | `azd ai agent eval init --trace-days 3 --max-samples 50 --no-prompt` |
| (c) Existing `eval.yaml` | Skip `init`; jump to the run step in the reference below |

After confirming the background terminal started without an immediate error, tell the user generation is running in the background and you'll surface status on a later turn, then proceed to Step 6. Skip only if the user explicitly says "skip eval suite generation."

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
| `eval init`: `one of --gen-instruction ... is required` | Retry with `--gen-instruction "<agent purpose>"` (Step 5 option (a)). |

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

Ask the user (one question) which source to use, then start `azd ai agent eval init` **in a background terminal** using your environment's async execution mechanism. `init` typically takes several minutes; do not block the deployment summary on its completion. See [After Deployment — Auto-Generate Evaluation Suite](#after-deployment--auto-generate-evaluation-suite) below for the full procedure (startup verification, error classification, and later-turn notification).

> *"Your agent is deployed. I'll now auto-generate an evaluation suite. Which source should I use? (a) Current agent instructions (synthetic Q&A), (b) Historical traces (last 3 days), or (c) Existing dataset/evaluators (skip init, run with current `eval.yaml`)."*

| Choice | Command |
|---|---|
| (a) Agent instructions | `azd ai agent eval init --gen-instruction "<agent purpose>" --no-prompt` |
| (b) Historical traces | `azd ai agent eval init --trace-days 3 --max-samples 50 --no-prompt` |
| (c) Existing `eval.yaml` | Skip `init`; jump to the run step in the reference below |

After confirming the background terminal started without an immediate error, tell the user generation is running in the background and you'll surface status on a later turn. Skip only if the user explicitly says "skip eval suite generation."

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

> ⚠️ **This step is automatic.** After a successful deployment, immediately prepare the evaluation suite without waiting for the user to request it. This matches the eval-driven optimization loop.

### 1. Inspect existing eval.yaml

Check the selected agent root for `eval.yaml`:

- **Exists and matches the selected agent** → skip `init`; go to step 3 (run).
- **Missing or stale** → continue to step 2.

### 2. Generate the suite (asynchronously)

`azd ai agent eval init` typically takes several minutes (dataset + rubric generation, judge calls, artifact download). Start it in a background terminal using whatever async execution mechanism your environment provides so the user is not blocked. On completion it writes:

- Agent instructions snapshot to `.agent_configs/baseline/instructions.md`.
- Dataset to `datasets/<suite-name>/*.jsonl`.
- Weighted rubric to `evaluators/<suite-name>/rubric_dimensions.json`.
- `eval.yaml` at the agent root, referencing the above via `local_uri` + versioned `dataset_reference` / `evaluators[]`.

**Skill behavior:**

1. Start `azd ai agent eval init <flags>` in a background terminal; capture the terminal/handle id.
2. Wait for the initial idle or output signal, then inspect the snapshot to verify startup. Do **not** wait for completion.
3. **Classify the snapshot** before proceeding:
   - **Progress output** (e.g., "Submitting jobs", "Generating", spinner output, no error text) → record the handle, tell the user *"Eval suite generation started in the background. You can keep working; I'll surface status on a later turn."*, and proceed to Step 6.
   - **Auto-fixable error** — the error message names a missing input the agent can derive from the current environment (for example, project endpoint resolvable via `azd env get-values`) → apply the fix, restart the background terminal **once**, re-inspect. If the second start still fails, fall through to the next bucket.
   - **Known cause, no auto-fix** (model not found, quota exceeded, permission denied, ambiguous agent name in a multi-service project, etc.) → surface the cause in one short message and ask the obvious follow-up. Do not restart automatically.
   - **Unknown error** → surface the raw error tail and recommend the user run `azd ai agent eval init` in the foreground for diagnostics. Stop.
4. On every later turn until the background terminal exits, re-check its output. When it reaches a terminal state, prepend a one-line status to that turn's response:
   - **Success** → *"`eval.yaml` is ready. Run `azd ai agent eval run` when you want to evaluate."*
   - **Failure** → show the error tail and recommend foreground `azd ai agent eval init` for diagnostics.

If your environment has no async execution mechanism (or the user is running commands manually), run `init` foreground instead and warn the user it will block until the suite is ready.

### 3. Run the suite

```bash
azd ai agent eval run
```

Use `azd ai agent eval show -O results.json` to inspect run details, or `azd ai agent eval list` to see history.

### 4. Refresh datasets/evaluators (later)

When local files under `datasets/<suite>/` or `evaluators/<suite>/` change, run `azd ai agent eval update --dataset-only` or `--evaluator-only` to upload new versions. azd bumps the `version` fields in `eval.yaml`.

### 5. Prompt User

If the background `init` from section 2 has not yet completed, defer this prompt — surface it together with the success message on the later turn when `eval.yaml` becomes ready.

*"Your agent is deployed and evaluation is set up. Would you like to run an evaluation now to identify optimization opportunities?"*

- **Yes** → run `azd ai agent eval run`, then follow the [observe skill](../observe/observe.md) to interpret results.
- **No** → stop. The user can return later via `azd ai agent eval run`.
- **Production trace analysis** → follow the [trace skill](../trace/trace.md).

## Non-Interactive / YOLO Mode

- Hosted: always pass `--no-prompt`. If `azd ai agent invoke` prints a `confirmation_required` envelope, summarize `changes[]` and re-run with `--force` after the user consents -- never auto-append `--force`.
- Prompt: all required values (project endpoint, agent name, model deployment) must come from the user message or `azd env get-values`; missing values should fail loudly rather than prompt.
