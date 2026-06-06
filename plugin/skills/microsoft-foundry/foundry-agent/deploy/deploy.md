# Deploy a Foundry Agent

Provision Azure resources when needed, deploy the agent with `azd`, and smoke-test it.

For **hosted agents** (custom Python / .NET / Node code), use `azd deploy`. Prefer **direct code deployment through azd**: `agent.yaml` contains `code_configuration:`, so `azd deploy` zips the source and lets Foundry build it. Use container/ACR deployment only when the agent truly needs a Dockerfile, custom system packages, or a pre-built image.

For **prompt agents** (LLM + instructions, no custom code), use the Foundry MCP `agent_update` tool.

Do not hand-write multipart REST direct-code upload scripts unless the user explicitly asks to bypass azd.

## Quick Reference

| Property | Value |
|----------|-------|
| Hosted CLI | `azd provision` when needed, `azd deploy --no-prompt`, `azd ai agent invoke`; use `azd ai agent show` only when structured status/endpoints are needed |
| Hosted default | Direct code via `azd deploy` (`code_configuration` present) |
| Hosted container | ACR/Docker via `azd deploy` (no code configuration, Dockerfile or `image:` present) |
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
| `image:` present and no code configuration | Register the pre-built image. |
| No code configuration, Dockerfile/container config present | Container/ACR deploy; Docker or remote build must be available. |
| Standard Python / .NET / Node agent with no system package needs | Add code configuration, then use direct code deploy. |

Use this direct-code block for Python Agent Framework samples:

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

If the user provided an existing project endpoint, project ARM ID, or model deployment, set those values before any local run or deploy. Then verify them with `azd env get-values`.

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

Branch on output:

- `not_deployed` -> continue.
- `active` / `deployed` -> redeploy if code or `agent.yaml` changed.
- `missing_project_endpoint` -> set `AZURE_AI_PROJECT_ENDPOINT` from the user-provided endpoint, or provision in Step 3.

### Step 2 -- Ensure direct code unless container is required

Open the selected service's `agent.yaml`.

1. Confirm the agent name matches the requested/generated name.
2. Confirm the matching `azure.yaml services:<service-name>` key is the same as the agent name. If it still has the sample service name, rename the service key and preserve its `project:` path; otherwise `azd deploy` can create the right agent but fail postdeploy while fetching the old service name.
3. Confirm the requested protocol, usually `responses`.
4. Confirm `AZURE_AI_MODEL_DEPLOYMENT_NAME` is referenced from `environment_variables`.
5. Add `code_configuration` when the agent is a normal Python / .NET / Node app and does not need custom OS packages.
6. If you change CPU or memory, update both `<service-dir>/agent.yaml` `resources` and `azure.yaml services.<name>.config.container.resources`; the `azure.yaml` value can override deployment CPU/memory.

If code configuration is absent, explicitly state that `azd deploy` will use the ACR/container path. Only proceed that way when the agent has a real container requirement.

### Step 3 -- Provision only when needed

Skip `azd provision` when all are true:

- The user supplied an existing Foundry project endpoint / ARM ID.
- `azd ai project show` resolves that project.
- No new model deployments, project connections, toolboxes, or infrastructure resources are required.

Run provision only for new projects or real infrastructure changes:

```bash
azd provision --no-prompt
```

If the target resource group already exists, keep `AZURE_LOCATION` aligned with that resource group to avoid `InvalidResourceGroupLocation`.

### Step 4 -- Deploy the agent

```bash
azd deploy --no-prompt
# Multi-service:
azd deploy <service-name> --no-prompt
```

What deploy does:

- Reads `<service-dir>/agent.yaml`, packages the agent, uploads it, and registers a new immutable version.
- **Direct code deploy** (`code_configuration` present): zips source, excludes `.agentignore`, and lets Foundry build the runtime image.
- **Container deploy** (no code configuration): builds/pushes via ACR or registers `image:`.

After deploy, azd writes `AGENT_<SVC>_NAME`, `AGENT_<SVC>_VERSION`, and `AGENT_<SVC>_<PROTO>_ENDPOINT` into the active env.

If deploy reports `Done` for the service and then fails only in `postdeploy` with `Agent <service-name> with version <n> not found`, the service key and `agent.yaml name` were mismatched. Rename the `azure.yaml services` key to the deployed agent name and rerun `azd deploy --no-prompt`; do not switch to container deploy.

### Step 5 -- Verify and invoke

For a fast smoke test in an azd project after `azd deploy` reports success, invoke the deployed agent directly:

```bash
azd ai agent invoke "hello, are you up?"
```

Use `azd ai agent show --output json` only when you need structured status, version, endpoints, a Playground link, or troubleshooting context. A successful remote invocation is the primary post-deploy health check.

If `azd ai agent invoke` returns a `confirmation_required` envelope, summarize the change and proceed only when the user already requested remote invocation or explicitly consents. Prefer the returned `confirmCommand` over inventing flags. If the azd invoke command cannot resolve the local service, follow [invoke](../invoke/invoke.md) and call `agent_invoke` using the project endpoint and agent name.

Anything other than a completed response -> run `azd ai agent doctor --output json`, then follow [troubleshoot](../troubleshoot/troubleshoot.md).

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
azd ai agent endpoint update --dry-run
azd ai agent endpoint update --force
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
| Docker daemon not running | You are on the container path. Add/fix `code_configuration` and retry direct code deploy, unless the agent truly needs container deployment. |
| ACR push 403 | You are on the container path. Prefer direct code if possible; otherwise fix `AcrPush` permissions. |
| `container registry endpoint not found` | You are on the container path. Add code configuration or configure ACR. |
| Agent version poll times out | Build still running; retry `azd ai agent show` after a minute. |
| `session_not_ready` (424) | Cold start or readiness delay. Wait 15-30 seconds and retry. If persistent, use `1` CPU / `2Gi`, verify the model deployment name, capability host, and agent identity role. |
| `invalid value "json" for --output` from `azd ai agent invoke` | Invoke supports only `default` and `raw`. Retry without `--output json`. |
| `could not resolve agent service in azd project: no azure.ai.agent service named '<agentName>' found in azure.yaml` from `azd ai agent invoke` | Name mismatch. Use the service name, update `agent.yaml`, or invoke through the Foundry MCP `agent_invoke` tool. |
| `subscription quota exceeded` | Ask user to request quota; do not auto-retry. |
| Bicep deploy errors | Forward `error.details[]` verbatim to the user. |
| `RoleAssignmentUpdateNotPermitted` during provision | A role assignment already exists but conflicts. Verify project and agent identity permissions manually. |

For deeper logs, see [troubleshoot](../troubleshoot/troubleshoot.md).

## Workflow -- Prompt agent (MCP)

Prompt agents are not containerized. Use when the user explicitly wants a prompt agent.

### MCP tools

| Tool | Purpose |
|------|---------|
| `agent_definition_schema_get` | Get the schema (`schemaType: "prompt"`). |
| `agent_update` | Create or update; supports `isCloneRequest` + `cloneTargetAgentName`. |
| `agent_get` | List or fetch one. |
| `agent_delete` | Delete an agent. |

### Steps

1. Resolve endpoint from `azd env get-values` or the user.
2. Ask for agent name, model deployment, optional instructions, temperature, and tools.
3. Get schema with `agent_definition_schema_get`.
4. Create or update with `agent_update`.
5. Smoke test through [invoke](../invoke/invoke.md).

## Display agent details

After a successful deploy, show the agent name and version from `azd deploy` output when available, plus the remote smoke-test result. Run `azd ai agent show --output json` for endpoint details only when the user needs them or deploy/invoke output did not include enough information.

## Non-Interactive / YOLO Mode

- Hosted: always pass `--no-prompt` to write commands.
- Existing project: if endpoint, project ARM ID, and model deployment are in the prompt, set them in azd env and do not ask again.
- Direct code: if a standard Python / .NET / Node hosted agent lacks `code_configuration`, add it before deploy.
- Remote smoke test: if `azd ai agent invoke` returns a confirmation envelope, use its `confirmCommand` only after the user requested or consented to remote invocation.
- Prompt: required values must come from the user message or `azd env get-values`; missing values should fail loudly rather than prompt.
