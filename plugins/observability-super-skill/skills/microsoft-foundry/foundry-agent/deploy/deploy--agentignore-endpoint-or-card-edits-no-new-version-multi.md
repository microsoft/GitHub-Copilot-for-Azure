# Selected guidance: `.agentignore`; Endpoint or card edits -- no new version; Multi-environment deploys; Common failure modes -- Hosted; Workflow -- Managed Har

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

## `.agentignore`

`azd ai agent init` writes a default `<service-dir>/.agentignore` for code deploy projects (gitignore syntax) that excludes tooling files, secrets, language artifacts, and Docker files from the deploy ZIP. Only the root file is read; use `!path` to force-include.

## Endpoint or card edits -- no new version

When only `agentEndpoint:` or `agentCard:` changed in the `azure.yaml` service block:

```bash
azd ai agent endpoint update          # patch in place
azd ai agent endpoint update --force  # skip confirmation for breaking changes
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
| `invalid_connection` | Inspect with `azd ai connection show <name>`. |
| Docker daemon not running | You are on the container path. Add/fix `codeConfiguration` and retry code deploy. Only install Docker or try remote image build if you specifically need container deploy. |
| ACR push 403 | Foundry project RBAC is missing `AcrPush` for your identity. Consider switching to code deploy to avoid ACR entirely. |
| `[ImageError] Container registry authentication failed` | The Foundry project managed identity lacks **AcrPull**, or **Container Registry Repository Reader** on an ABAC registry. Grant it before retrying. |
| `container registry endpoint not found` | ACR is not configured. Use `azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT <url>`, or switch to code deploy. |
| Agent version poll times out | Build still running; retry `azd ai agent show` after a minute. |
| `session_not_ready` (424) | Cold start or readiness delay. Wait 15-30 seconds and retry. If persistent, use `1` CPU / `2Gi` memory minimum, verify the model deployment name, capability host, and agent identity role. |
| `invalid value "json" for --output` from `azd ai agent invoke` | Invoke supports only `default` and `raw` currently. Retry without `--output json`. |
| `could not resolve agent service in azd project: no azure.ai.agent service named '<agentName>' found in azure.yaml` from `azd ai agent invoke` | Name mismatch. Use the service name, update the `azure.yaml` service block, or use `--agent-endpoint` when invoking outside the project. |
| `subscription quota exceeded` | Ask user to request quota; do not auto-retry. |
| Bicep deploy errors | Forward `error.details[]` verbatim to the user. |
| `RoleAssignmentUpdateNotPermitted` during provision | A role assignment already exists but conflicts. Check for existing role assignments with `az role assignment list --scope <resource-scope>`. The provision may have succeeded for all resources except RBAC — verify with `azd ai project show` and manually assign the `Cognitive Services User` role to the agent identity if needed. |
| `eval generate`: `one of --gen-instruction ... is required` | Retry with `--gen-instruction "<agent purpose>"` (Step 6 option (a)). |
| `unknown command "init" for "azd ai agent eval"` | Command was renamed: use `azd ai agent eval generate` (requires azd CLI with `azure.ai.agents` extension up to date). |

For deeper logs, see [troubleshoot](../troubleshoot/troubleshoot.md).

## Workflow -- Managed Harness Agent (azd)

A Microsoft Foundry Managed Harness Agent is a declarative Prompt Agent configuration that this workflow deploys with azd. Read [create-managed-harness](../create/create-managed-harness.md) before creating or editing it.

### Step 1: Resolve and validate

Inside the azd project, select the service and verify that it is a Prompt Agent
using either recognized Copilot harness discriminator. New authoring uses:

```yaml
host: azure.ai.agent
kind: prompt
harness:
  type: microsoft_copilot_preview
```

Existing services may use legacy `github_copilot_preview`; preserve the
authored harness and toolset discriminator family. Reject Hosted-only
code/container fields. Do not convert an ordinary Prompt or Hosted Agent in
place.

Resolve the active environment:

```bash
azd env get-values
azd ai project show --output json
azd ai agent show --output json
```

If the Agent is not deployed, continue to provisioning. If active/deployed, skip provisioning unless infrastructure changed.

### Step 2: Provision when required

Run `azd provision --no-prompt` only for a new Foundry project, a new model deployment, or another real infrastructure change. If no project is configured and the user did not select a new or existing project, stop and ask.

A Managed Harness Agent does not require Hosted Agent source packaging, Docker, ACR, runtime, protocol, or container configuration.

### Step 3: Deploy

```bash
azd deploy <service-name> --no-prompt
```

Deployment reads the Prompt Agent definition from `azure.yaml` and creates a new immutable version. It must not package source or build a container.

### Step 4: Verify and invoke

```bash
azd ai agent show --output json
```

Verify the version is active/deployed and the published definition retains:

- `kind: prompt`
- New definitions use `harness.type: microsoft_copilot_preview`.
- Existing definitions retain their authored Microsoft or legacy GitHub harness/toolset discriminator family.
- Requested direct tools
- Exact versioned Toolbox MCP endpoint and matching short `project_connection_id`, when explicitly configured
- Versioned Skill references, when explicitly configured

A successful deploy that drops the harness is a failure.
A redeploy that silently changes an existing Copilot harness or toolset discriminator family is also a failure.

Run one remote smoke invocation:

```bash
azd ai agent invoke <service-name> "hello, are you up?"
```

Follow the Managed Harness Agent branch in [invoke](../invoke/invoke.md). Do not use Hosted sessions/files/monitor and do not start evaluation generation in Phase 1.

### Step 5: Hand off

Show Agent name, version, project, model, harness, tools, optional Toolbox, deployment status, and smoke-test status.

## Common failure modes -- Managed Harness Agent

| Error | Fix |
|---|---|
| Deploy packages code/container | Remove Hosted-only fields and verify `kind: prompt` |
| Published definition lacks harness | Fix `harness.type`, verify the extension version, and redeploy |
| Tool shape rejected | Read the matching Managed Harness Agent tool reference and preserve REST field names |
| Connection missing | Use a user-supplied/existing configured connection, or create it only on explicit request |
| Toolbox MCP returns `401` | Verify the MCP tool has a matching `UserEntraToken` project connection with audience `https://ai.azure.com` and target equal to the exact versioned Toolbox endpoint |

## Workflow -- Voice Agent (azd)

Follow [Voice Agent deployment](references/voice-deploy.md) for Prompt Voice and Hosted Voice provisioning, deployment order, and two-stage verification.

## Workflow -- Prompt agent (MCP)

Ordinary Prompt Agents are not containerized -- they are a model + instructions + optional tools, created through the Foundry MCP server. Do not use this branch for a Managed Harness Agent.

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
5. **Auto-generate evaluation suite** -- see [Step 5: Auto-Generate Evaluation Suite (Prompt)](deploy--agentignore-endpoint-or-card-edits-no-new-version-multi.md#step-5-auto-generate-evaluation-suite-prompt-mandatory--runs-automatically) below.
6. **Hand off** -- evaluate via [observe](../observe/observe.md); clone via `agent_update` + `isCloneRequest`; delete via `agent_delete`.

### Step 5: Auto-Generate Evaluation Suite (Prompt) (MANDATORY — RUNS AUTOMATICALLY)

> ⚠️ **Pre-summary gate.** If you are about to write a deployment summary or Playground link and Step 5 has not run, you are violating this skill. Run Step 5 first.

This step runs automatically after deploy. Ask the user which source to use and start it right after deploy succeeds — with `--no-wait`, `generate` returns in seconds and generation runs server-side, so it overlaps with invoke/test steps and finishes faster overall.

> *"Your agent is deployed. Want me to set up an evaluation suite now? (a) Yes — current agent instructions (synthetic Q&A), (b) Yes — historical traces (last 3 days), (c) Yes — use existing `eval.yaml`, (d) No / later."*

| Choice | Command | What's next |
|---|---|---|
| (a) Agent instructions | `azd ai agent eval generate --gen-instruction "<agent purpose>" --no-wait --no-prompt` | Generation runs server-side. Tell the user: *"Suite submitted. Run `azd ai agent eval run` whenever you're ready — it'll finalize `eval.yaml` and execute the eval in one step."* |
| (b) Historical traces | `azd ai agent eval generate --trace-days 3 --max-samples 50 --no-wait --no-prompt` | Same as (a). |
| (c) Existing `eval.yaml` | Skip `generate`. | Tell the user: *"Using existing `eval.yaml`. Run `azd ai agent eval run` when ready."* |
| (d) No / later | Skip. | Tell the user: *"You can run `azd ai agent eval generate` (and then `eval run`) anytime."* |

