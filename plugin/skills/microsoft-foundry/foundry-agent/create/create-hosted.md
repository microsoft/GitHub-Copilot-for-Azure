# Create Hosted Agent (azd ai)

Scaffold a hosted Foundry agent project with the Azure Developer CLI (`azd`) and the `azure.ai.agents` extension. The same flow covers greenfield (from a curated sample) and brownfield (lift existing code), then drops you into a local inner-loop so you can iterate before deploying.

> **Scope:** `azd ai` is the preferred *code-first* path -- use it when the intent is agent code on disk, in a repo, with infrastructure-as-code and a local inner-loop. If the intent is only to create a remote agent resource (no code on disk), other approaches may apply -- for prompt agents see [create-prompt.md](create-prompt.md), or use the Foundry MCP tools / portal.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent type | Hosted (container or code) |
| Primary CLI | `azd ai agent` (from extension `azure.ai.agents`) |
| Scaffold command | `azd ai agent init -m <manifestUrl> --deploy-mode code --runtime python_3_13 --entry-point main.py`, pass `--runtime dotnet_10 --entry-point MyAgent.dll` for .NET project (or `--from-code` for brownfield) |
| Local run | `azd ai agent run` + `azd ai agent invoke --local "..."` |
| Deploy handoff | [deploy/deploy.md](../deploy/deploy.md) |
| Sample catalog | `azd ai agent sample list --featured-only --output json` |
| Reference docs | [azd-ai-cli](references/azd-ai-cli.md), [local-run](references/local-run.md), [tools](references/tools.md) |

## When to Use This Skill

- Create a new hosted agent from a curated Foundry sample.
- Lift an existing agent project (Python, .NET, Node.js) into a hosted Foundry agent.
- Add tools (web search, AI Search, MCP, A2A) to a hosted agent.
- Run and iterate on a hosted agent locally before deploying.

For prompt agents (LLM + instructions, no container), use [create-prompt.md](create-prompt.md). For deploy, use [deploy.md](../deploy/deploy.md).

## Hosted vs Prompt

| | Hosted | Prompt |
|--|--------|--------|
| Custom Python / .NET / Node code? | Yes -> this skill | No -> [create-prompt.md](create-prompt.md) |
| Tools / RAG / MCP / A2A | Toolbox + connections | Built-in tool configs |
| Local debugging | `azd ai agent run` | Limited |
| Output | New immutable agent version per `azd deploy` | `agent_update` via MCP / SDK |

## Workflow

### Step 1 -- Verify the environment

Run the bundled verification script to check that the local environment is set up correctly:

```bash
./scripts/verify-environment.sh     # macOS / Linux
./scripts/verify-environment.ps1    # Windows (pwsh)
```

Act on the summary prefixes: `[OK]` nothing to do; `[WARN]` non-blocking (continue); `[ACTION]` resolve first (missing extension -> `azd extension install azure.ai.agents`; failed auth -> ask the user to run `azd auth login`, never run it yourself).

Branch on the reported agent status:

- `not_deployed` -> Step 2.
- `active` / `deployed` -> already deployed. Skip to [deploy/deploy.md](../deploy/deploy.md) for redeploy or [tools](references/tools.md) to add a tool.

### Step 2 -- New or existing Foundry project?

Ask: "Do you want to create a new Foundry project, or use an existing one?"

- **New project** -- do NOT pass `--project-id`. `azd provision` (in deploy) will create it.
- **Existing project** -- ask for the ARM resource ID:
  > Open https://ai.azure.com -> Operate -> Admin -> select the project -> Copy the Resource ID.

Do not guess or shell out to `az` to discover the ID.

### Step 3 -- Pick the scaffolding source

| User has ... | Use |
|--------------|-----|
| Empty workspace, or wants a starter | **Greenfield** -- Step 4a |
| Hand-written agent code already in cwd | **Brownfield** -- Step 4b |

If unsure, default to greenfield. Never guess a manifest URL by hand.

### Step 4a -- Greenfield: scaffold from a sample

List the curated catalog (filter by language if known):

```bash
azd ai agent sample list --featured-only --language python --output json
```

Each entry has a `manifestUrl` and an `initCommand`. Prefer direct code deploy at init time. `--no-prompt` defaults to container deploy unless you pass `--deploy-mode code`, so include the code flags up front.

For a generic new hosted agent request, start from the basic sample. Use tool/function-calling samples only when the user explicitly asks for external actions, APIs, tools, connectors, or data lookup.

Python Example (add `--project-id "<resourceId>"` for an existing Foundry project; add `--agent-name <name>` if the user wants a custom name -- omit otherwise to keep the sample default):

```bash
azd ai agent init --no-prompt \
  -m "<manifestUrl>" \
  --deploy-mode code \
  --runtime python_3_13 \
  --entry-point main.py
```

> `--agent-name` at init names both `agent.yaml name:` and `azure.yaml services:<key>:` in one shot; renaming after init requires editing both files.

Do not run `azd env new`, `azd env select`, or `azd env set` before `azd ai agent init` in a new temp/workspace; there is no azd project yet, so those commands fail and waste time. For an existing project, `--project-id` is enough during init. Set endpoint/model values immediately after init, once `azure.yaml` and the azd env exist.

> Tip: if the manifest declares a `parameters:` block (check by `curl <manifestUrl>`), collect required values before init when an azd project already exists. In a new empty workspace, prefer a sample without required secrets; there is no azd env to set until init creates the project files.

`init` writes `azure.yaml` (or appends to it), `<service-dir>/agent.yaml`, and `<service-dir>/.agentignore` (code-deploy only). A successful direct-code init produces `<service-dir>/agent.yaml` with `code_configuration:`. For file shapes, see [azd-ai-cli](references/azd-ai-cli.md).

Check the scaffold before local run:

1. If the user supplied an existing project endpoint, project ARM ID, or model deployment name, set them in the active azd env and verify the values. `azd ai agent run` injects azd env values before `.env`, so a stale `AZURE_AI_MODEL_DEPLOYMENT_NAME` can override a correct `.env` file.
   ```bash
   azd env set AZURE_AI_PROJECT_ENDPOINT "<project-endpoint>"
   azd env set AZURE_AI_PROJECT_ID "<project-arm-id>"
   azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model-deployment-name>"
   azd env get-values
   ```
2. Create the agent source `.env` with the same endpoint and model deployment values:
   ```env
   FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
   AZURE_AI_MODEL_DEPLOYMENT_NAME=<model-deployment-name>
   ```
3. Prefer direct code deployment. Inspect `<service-dir>/agent.yaml`; if `code_configuration:` is missing and the agent does not need a custom Dockerfile or system packages, add it before deployment.
4. Prefer `--agent-name` at init time (above). Fallback only: if init already ran without it, rename the agent in `<service-dir>/agent.yaml` AND the matching key under `azure.yaml services:` to the same value, preserving its `project:` path.
5. If you change CPU or memory, keep `<service-dir>/agent.yaml` and `azure.yaml services.<name>.config.container.resources` aligned because the `azure.yaml` service config can override the agent file.

### Step 4b -- Brownfield: lift existing code

Use ONLY when the workspace already contains hand-written agent source.

```bash
azd ai agent init --no-prompt \
  --src ./src/my-agent \
  --agent-name my-agent \
  --deploy-mode code \
  --runtime python_3_13 \
  --entry-point app.py
```

`--runtime` and `--entry-point` are required with `--deploy-mode code --no-prompt`. Runtimes: `python_3_13`, `python_3_14`, `dotnet_10`, `node_22`. `--deploy-mode container` builds from `Dockerfile`. For an existing Foundry project, add `--project-id "<resourceId>"`.

### Step 5 -- Run locally and iterate

Read and follow [local-run](references/local-run.md). Complete one representative local invocation before deploying.

### Step 6 -- Add tools (optional)

Tools attach through **toolboxes** -- bundled MCP-compatible endpoints. Flow:

1. Create the **connection** (`azd ai agent connection create ...`).
2. Create or update the **toolbox** (`azd ai toolbox create` / `connection add`).
3. Set the agent env var (`azd env set TOOLBOX_<NAME>_MCP_ENDPOINT ...`).
4. Reference it in `agent.yaml` `environment_variables[]`.
5. `azd deploy`.

Full recipes (GitHub MCP, Azure AI Search, A2A, Bing Custom) in [tools](references/tools.md).

### Step 7 -- Hand off to deploy

Once local invocation succeeds, tell the user the agent is ready and ask if they want to deploy. Read [deploy/deploy.md](../deploy/deploy.md).

## Common Guidelines

1. **Sample-first** -- always get `manifestUrl` from `azd ai agent sample list`.
2. **Prefer azd over az** -- fall back to `az` only as a last resort, with explicit consent.
3. **Don't auto-login** -- `azd auth login` opens a browser; ask the user.
4. **JSON output** -- add `--output json` only to read-only `azd ai agent` commands such as `show`. Do not add it to `azd ai agent invoke`; invoke supports `default` and `raw`, not `json`.
5. **Two files** -- `agent.yaml` is the agent; `azure.yaml services.<name>.config` is service config. See [azd-ai-cli](references/azd-ai-cli.md).
6. **Reserved env vars** -- `FOUNDRY_*` and `AGENT_*` are platform-injected at runtime. Never set them.

## Non-Interactive / YOLO Mode

Defaults when unspecified: greenfield + Python + `azd ai agent sample list --featured-only --language python`, choose the simplest recommended sample that matches the request, plus `--no-prompt` on every write. If creating a new project and the user did not provide a project name, auto-generate one using the pattern `ai-project-<random>` (6-8 lowercase alphanumeric characters). Show the generated name to the user but do not block on confirmation. If project ID is missing and the user wants to use an existing project, stop and ask. If the manifest declares secret parameters, collect them with `ask_user` and set them via `azd env set PARAM_...` before init -- keep `--no-prompt` (do not fall into azd's interactive prompts).

## Error Handling

| Error | Fix |
|-------|-----|
| `extension not installed` | `azd extension install azure.ai.agents` |
| `not_logged_in` / `login_expired` | Ask user to run `azd auth login` |
| `missing_project_endpoint` | Run `azd provision`, or `azd env set AZURE_AI_PROJECT_ENDPOINT <url>` |
| `project_not_found` | cwd has no `azure.yaml`; move to project root or run init |
| Secret parameter prompt under `--no-prompt` | In an empty workspace, choose a simpler sample without secret parameters. In an existing azd project, set `PARAM_<CONN>_<KEY>` with `azd env set` before init; keep `--no-prompt`. |
| `cannot use --version with --local` | Drop `--version`, or drop `--local` to hit the deployed agent |
| `could not detect project type` | Set `startupCommand` in `azure.yaml` or pass `--start-command` |
| Local run issue | Follow [local-run](references/local-run.md) common failures |

Run `azd ai agent doctor --output json` to surface failing checks with `suggestion` fields.

## Next Steps

- Deploy to Foundry -> [deploy/deploy.md](../deploy/deploy.md)
- Add tools -> [tools](references/tools.md)
- Invoke the deployed agent -> [invoke/invoke.md](../invoke/invoke.md)
- Evaluate / optimize -> [observe/observe.md](../observe/observe.md)
- Diagnose failures -> [troubleshoot/troubleshoot.md](../troubleshoot/troubleshoot.md)
