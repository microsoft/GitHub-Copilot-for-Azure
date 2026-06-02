# Deploy a Foundry Agent

Provision Azure resources, deploy the agent, and smoke-test it.

For **hosted agents** (custom container or code), prefer **direct code deployment** (no Docker/ACR required) via the Foundry REST API. Fall back to `azd deploy` only when container-based deployment is explicitly needed (custom Dockerfile, system-level dependencies, or pre-built images).

For **prompt agents** (LLM + instructions, no container), use the Foundry MCP `agent_update` tool.

## Quick Reference

| Property | Value |
|----------|-------|
| Hosted (recommended) | **Direct code deployment** via REST API — see [direct-code-deployment](references/direct-code-deployment.md) |
| Hosted (container) | `azd provision`, `azd deploy` (requires Docker/Podman + ACR) |
| Prompt MCP | `agent_definition_schema_get`, `agent_update`, `agent_get`, `agent_delete` |
| Versioning | Each successful deploy creates an immutable agent version |
| Endpoint-only patch | `azd ai agent endpoint update` (no new version) |
| Local dev | [create-hosted](../create/create-hosted.md), [local-run](../create/references/local-run.md) |

## Hosted vs Prompt

- Shipping Python / .NET / Node code -> **Hosted** (direct code deployment below, or azd container workflow).
- Updating only model / instructions / tools -> **Prompt** (MCP workflow below).

## Deployment Method Selection -- Hosted agents

| Condition | Recommended Method |
|-----------|-------------------|
| Standard Python / .NET agent, no Docker installed | **Direct code deployment** (default) — [direct-code-deployment](references/direct-code-deployment.md) |
| Agent needs custom system packages, Dockerfile, or pre-built image | Container deploy via `azd deploy` (Step 3b below) |
| Docker/Podman not installed and no ACR configured | **Direct code deployment** — container deploy will fail |
| CI/CD pipeline with Docker available | Either method works; direct code is simpler |

> 💡 **Default recommendation:** Use direct code deployment. It requires no Docker, no ACR, no `azd provision`, and works with just the project endpoint + `az` CLI authentication. The Foundry platform handles dependency installation and runtime image building via `remote_build`. See [direct-code-deployment](references/direct-code-deployment.md) for the full workflow.

## Workflow -- Hosted agent (direct code deployment — recommended)

> Prerequisite: agent source code exists locally (from `azd ai agent init` or hand-written). Project endpoint is known.

Follow the complete workflow in **[direct-code-deployment](references/direct-code-deployment.md)**. Summary:

1. **Preflight** — resolve project endpoint, get access token (`az account get-access-token --resource https://ai.azure.com`).
2. **Detect runtime** — Python → `python_3_13`, .NET → `dotnet_10`, etc.
3. **Create `metadata.json`** — agent definition with protocol, CPU/memory (`1` CPU / `2Gi` recommended), environment variables, and code configuration.
4. **Create flat zip** — `main.py` + `requirements.txt` (Python) at zip root. Exclude `.env`, `.foundry/`, `__pycache__/`.
5. **Upload via REST** — `POST <endpoint>/agents` (new) or `POST <endpoint>/agents/<name>/versions` (update). Multipart form with metadata + code zip.
6. **Poll version** — `GET .../versions/<version>` until `active` (~60-90s for remote_build).
7. **Smoke test** — invoke the agent (Step 4 below).

> ⚠️ **Cold start:** The first invocation after a direct code deployment may take 60-90 seconds due to dependency installation. If you get `424 session_not_ready`, wait 30-60 seconds and retry. See [invoke](../invoke/invoke.md) error handling for retry guidance.

## Workflow -- Hosted agent (azd container deploy — alternative)

> Prerequisite: project scaffolded with `azd ai agent init`. Docker or Podman installed. If not, use direct code deployment above.

### Step 1 -- Verify state

```bash
azd ai project show     # Foundry project endpoint
azd ai agent show       # status: not_deployed | active
```

Branch on output: `not_deployed` -> Step 2. `active` / `deployed` -> redeploy (skip Step 2, go to Step 3b). If `azd ai project show` fails with `missing_project_endpoint`, do Step 2 first -- `azd provision` will create the project.

### Step 2 -- Provision Azure resources (one-time per env)

> **Region selection:** Before provisioning, check if the target resource group already exists and detect its region. A region mismatch causes `InvalidResourceGroupLocation` errors. Run:
> ```bash
> az group show --name <resource-group> --query location -o tsv 2>/dev/null
> ```
> If the group exists, set `AZURE_LOCATION` to match: `azd env set AZURE_LOCATION <existing-region>`. If the group does not exist, prefer a region with broad Foundry support such as `eastus2`, `westus3`, or `swedencentral`.

> **Capability host check:** After provisioning, verify a capability host exists for hosted agents. Without it, all invocations will fail with `session_not_ready`. Check:
> ```bash
> az rest --method get \
>   --url "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/capabilityHosts?api-version=2025-04-01-preview" \
>   --query "value[].name" -o tsv
> ```
> If the output is empty, create one:
> ```bash
> curl -s -X PUT \
>   "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/capabilityHosts/agents?api-version=2025-04-01-preview" \
>   -H "Authorization: Bearer $(az account get-access-token --query accessToken -o tsv)" \
>   -H "Content-Type: application/json" \
>   -d '{"properties":{"capabilityHostKind":"Agents","vectorStoreConnections":[],"storageConnections":[],"aiServicesConnections":[]}}'
> ```
> Poll `provisioningState` until `Succeeded` (typically < 30 seconds).
> This applies to both `azd provision` and direct code deployment paths.

```bash
azd provision --no-prompt
```

> Optional: run `azd provision --preview --no-prompt` first to preview the resource changes (a what-if) before applying them.

What this does:

- Creates the Foundry project (if not present) and supporting resources under `infra/`.
- Creates project connections declared in `azure.yaml services.<name>.config.connections[]`. `${PARAM_*}` placeholders resolve from the active azd env.
- Wires model deployments, AI Search, ACR, etc. `infra/layers/` provision in parallel when present.

This is a core `azd` command. Skip provision when the user gave you an existing `AZURE_AI_PROJECT_ENDPOINT` via `azd env set` -- the extension uses the existing project as-is.

### Step 3b -- Deploy the agent (container)

```bash
azd deploy --no-prompt
# Multi-service: azd deploy my-agent --no-prompt
```

What deploy does:

- Reads `<service-dir>/agent.yaml`, packages the agent, uploads, registers a new immutable version.
- **Code deploy** (`codeConfiguration:` present): ZIPs source (excluding `.agentignore` entries); Foundry builds the runtime image.
- **Container deploy** (no `codeConfiguration:`): builds the `Dockerfile`, pushes to the project's ACR, registers the version. When `agent.yaml` has `image:` set, `azd` reuses the pre-built image.

After deploy, the extension writes `AGENT_<SVC>_NAME`, `AGENT_<SVC>_VERSION`, and `AGENT_<SVC>_<PROTO>_ENDPOINT` (one per protocol) into the active azd env.

Re-deploying an identical build still creates a new version; the extension prints `Agent version <n> is already active.` and skips the poll.

### Step 4 -- Verify the deployment

```bash
azd ai agent show --output json
```

Expect `"status": "active"` (or `"deployed"`) and an `agent_endpoints` map.

> **Do not smoke-test here.** Invocation with retry logic, cold-start handling, and session management is covered by the [invoke skill](../invoke/invoke.md). Proceed directly to Step 5 to hand off.

Anything other than `active` / `deployed` status -> run `azd ai agent doctor --output json`, then follow [troubleshoot](../troubleshoot/troubleshoot.md).

### Step 5 -- Invoke and hand off

Follow [invoke](../invoke/invoke.md) to send the first test message and verify the agent responds correctly. The invoke skill handles cold-start retries, session creation, and error recovery.

After a successful invocation:
- Evaluate / optimize -> [observe](../observe/observe.md)
- Diagnose failures -> [troubleshoot](../troubleshoot/troubleshoot.md)
- Search traces / latency -> [trace](../trace/trace.md)

## `.agentignore`

`azd ai agent init` writes a default `<service-dir>/.agentignore` for code-deploy projects (gitignore syntax) that excludes tooling files, secrets, language artifacts, and Docker files from the deploy ZIP. Only the ROOT file is read; use `!path` to force-include.

## Endpoint or card edits -- no new version

When only `agentEndpoint:` or `agentCard:` changed in `agent.yaml`:

```bash
azd ai agent endpoint update --dry-run    # preview
azd ai agent endpoint update --force      # apply
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
| `missing_project_endpoint` | Run `azd provision`, or `azd env set AZURE_AI_PROJECT_ENDPOINT <url>`. |
| `invalid_agent_manifest` | `azd ai agent doctor`; fix the named field. |
| `invalid_connection` | Inspect with `azd ai agent connection show <name>`. |
| Docker daemon not running | **Use direct code deployment instead** (no Docker required) — see [direct-code-deployment](references/direct-code-deployment.md). Only install Docker if you specifically need container deploy. |
| ACR push 403 | Foundry project RBAC missing `AcrPush` for your identity. Consider switching to direct code deployment to avoid ACR entirely. |
| `container registry endpoint not found` | ACR not configured. Use `azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT <url>`, or switch to direct code deployment. |
| Agent version poll times out | Image still building; retry `azd ai agent show` after a minute. |
| `session_not_ready` (424) | Cold start — wait 30-60 seconds and retry. For direct code deployments, first invocation installs dependencies. Use `1` CPU / `2Gi` memory minimum. **Also verify:** (1) a capability host exists on the Foundry account (see Step 2 above), (2) the agent's managed identity has `Cognitive Services User` role on the Foundry account — missing capability host or role are the most common causes of persistent `session_not_ready`. See [direct-code-deployment Task 8-9](references/direct-code-deployment.md) and [invoke](../invoke/invoke.md). |
| `subscription quota exceeded` | Ask user to request quota; don't auto-retry. |
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
5. **Hand off** -- evaluate via [observe](../observe/observe.md); clone via `agent_update` + `isCloneRequest`; delete via `agent_delete`.

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

## Non-Interactive / YOLO Mode

- Hosted: always pass `--no-prompt`. If `azd ai agent invoke` prints a `confirmation_required` envelope, summarize `changes[]` and re-run with `--force` after the user consents -- never auto-append `--force`.
- Prompt: all required values (project endpoint, agent name, model deployment) must come from the user message or `azd env get-values`; missing values should fail loudly rather than prompt.
