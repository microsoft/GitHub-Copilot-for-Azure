# Create Hosted Agent Application

Create new hosted agent applications for Microsoft Foundry, or convert existing agent projects to be Foundry-compatible. The recommended path is the **`azd ai agent` CLI** (preview). This skill does NOT use direct `az` CLI, REST calls, or MCP tools for the create flow.

## Quick Reference

| Property | Value |
|----------|-------|
| **Primary tool** | `azd ai agent` CLI (preview) |
| **Templates** | `azd ai agent template list -o json` |
| **Scaffold** | `azd ai agent init [-m <manifest>] [--src <dir>] [--protocol <p>] [--agent-name <name>]` |
| **Local run** | `azd ai agent run` (serves on `:8088`) |
| **Local invoke** | `azd ai agent invoke --local <payload>` |
| **Provision deps** | `azd provision` (project, model, etc. that the agent needs) |
| **Hosted Agents Docs** | https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents |
| **Default Selection** | `Python` + `responses` + `Microsoft Agent Framework` |
| **Best For** | Creating new or converting existing agent projects for Foundry |

## When to Use This Skill

- Create a new hosted agent application from scratch (greenfield)
- Start from an official Foundry template and customize it
- Convert an existing agent project to be Foundry-compatible (brownfield)
- Help user choose a language, protocol, framework, or starter template for their agent

> ⚠️ **Do NOT** call `az`, REST endpoints (`api.github.com/repos/...`), or MCP `foundry_*` tools from this workflow. Use the `azd ai agent` CLI commands listed in Quick Reference. If a needed `azd ai agent` subcommand is not yet installed, fall back to the interactive form of `azd ai agent init` and call out the gap to the user. (See [Common Guidelines](#common-guidelines) for the full set of guardrails.)

## Prerequisites

Verify before starting:

1. **`azd` installed** - run `azd version`. If missing: https://aka.ms/azure-dev/install
2. **`azd ai` extension installed** - run `azd ai agent version`. If `azd ai` is not recognized, install the AI extension per https://aka.ms/azd-ai-agent-docs.
3. **Signed in** - `azd auth login --check-status`; run `azd auth login` if needed.

## Workflow

> Relative reference paths in this file are resolved from the directory containing this file. For example, `./references/agentframework.md` means the file next to this document under `create/references/`.

### Step 1: Determine Scenario

Check the user's workspace for existing agent project indicators:

- **No agent-related code found** -> **Greenfield**. Proceed to Greenfield Workflow (Step 2).
- **Existing agent code present** -> **Brownfield**. Proceed to Brownfield Workflow (Step B1).

### Step 2: Gather Requirements (Greenfield)

If the user hasn't already specified, use `ask_user` to collect in this order:

**Language:** Python (default) or C#.

**Protocol:**

| Protocol | Best For |
|----------|----------|
| `responses` (default) | Conversational agents using the OpenAI-compatible `/responses` contract |
| `invocations` | Arbitrary payloads, custom SSE behavior, protocol bridges, webhook-style callers, or client-managed sessions |

**Framework:**

| Framework | Notes |
|-----------|-------|
| Microsoft Agent Framework (default) | Python and C# supported |
| LangGraph | Python only |
| Custom | Python and C# (Bring Your Own lanes) |

> ⚠️ **Warning:** LangGraph is Python-only. For C# + LangGraph, suggest Microsoft Agent Framework or Custom instead.

If the user has no specific preference, suggest **Python + `responses` + Microsoft Agent Framework** as defaults.

In non-interactive or YOLO mode, use those same defaults unless the user's request clearly requires another supported combination.

### Step 3: Discover and Select a Template

List the available Foundry agent templates:

```bash
azd ai agent template list -o json
```

Each template entry includes metadata (language, protocols, framework, tags) and a ready-to-run init command (typically `azd ai agent init -m <manifest-url>`). Match the user's intent (language, protocol, framework, and any specific use case such as RAG, tools, multi-agent, HITL) against the template list and pick the closest match.

If the user specified what the agent should do, pick the single best matching template directly. Otherwise, present the candidate templates to the user and let them choose.

> ⚠️ **Tools:** Hosted agents access tools through a **Foundry Toolbox** endpoint - they do NOT wire tools directly. If the user wants an agent with tools (web search, AI search, code interpreter, MCP servers, etc.), prefer toolbox-enabled templates. See [references/use-toolbox-in-hosted-agent.md](references/use-toolbox-in-hosted-agent.md) for the toolbox integration pattern and how to resolve a toolbox endpoint.

> 💡 **Fallback:** If `azd ai agent template list` is not yet available in the installed `azd ai` extension, run `azd ai agent init` with no flags. The CLI presents an interactive template picker. Use that picker to choose a template, then continue with Step 5.

### Step 4: Scaffold From the Selected Template

Run the init command bundled in the template entry. Pass optional flags as needed:

```bash
azd ai agent init -m <manifest-url> \
  [--agent-name <unique-foundry-agent-name>] \
  [--protocol <responses|invocations>] \
  [--model <model-name> | --model-deployment <existing-deployment-name>] \
  [--project-id <existing-foundry-project-id>] \
  [--src <target-directory>]
```

`azd ai agent init` writes:

- `agent.yaml` (Foundry agent definition - name, protocols, model, env vars)
- `azure.yaml` (or adds an agent service to an existing `azure.yaml`)
- `.agentignore` (controls ZIP packaging for code-deploy; uses `.gitignore` syntax)
- `infra/**` (Bicep for provisioning required Foundry resources)

> ⚠️ **Agent name uniqueness:** Foundry agents are unique by name within a project. Re-using a name creates a new **version** of the existing agent rather than a separate agent. Pass `--agent-name` when initializing from a reusable template to avoid collisions.

### Step 5: Customize and Implement

1. Read the template's `README.md` (linked from the template list entry) and the generated `agent.yaml` to understand structure, required env vars, and any tool/toolbox setup.
2. Read the scaffolded code to understand patterns, protocol handling, and dependencies used.
3. If using Microsoft Agent Framework, follow the best practices in [references/agentframework.md](references/agentframework.md).
4. Implement the user's specific requirements on top of the template.
5. Update configuration (`.env`, dependency files, `agent.yaml`) as needed. Keep the selected protocol consistent across code and `agent.yaml`.
6. Ensure the project is in a runnable state.

### Step 6: Provision Required Resources

The agent needs its Foundry project, model deployment, and any connected services to exist before it can run locally or remotely.

```bash
azd provision
```

This runs the Bicep templates written by `azd ai agent init` and persists outputs (project endpoint, model deployment name, etc.) into the azd environment. Subsequent `azd ai agent run` calls read these values automatically.

If `--project-id` was passed to `azd ai agent init`, provisioning skips creating a new project and reuses the existing one.

### Step 7: Verify Locally

1. Start the local agent server in the background:

   ```bash
   azd ai agent run
   ```

   `azd ai agent run` detects the project type, installs dependencies, translates azd environment values into `FOUNDRY_*` env vars, and serves on `http://localhost:8088`.

2. Send a real test request from a separate shell:

   ```bash
   azd ai agent invoke --local "<payload>"
   ```

   - **Template-scaffolded** projects: take the payload from the template `README.md`.
   - **Brownfield** projects: take the payload from the user's code (handler signatures, request schemas, test fixtures).
   - If neither yields a payload, ask the user with `ask_user` - a literal `"hello"` does not work for all agents.
   - For `invocations` agents with structured bodies: `azd ai agent invoke --local --protocol invocations -f <file>.json`.

3. Fix errors and retry until the request succeeds, then stop the `azd ai agent run` process.

**Guardrails:**
- ✅ Real `azd provision` -> `azd ai agent run` -> `azd ai agent invoke --local` cycle - do not fake it.
- ✅ Stop the local server after verification.
- ✅ Ignore Azure-side auth/connection errors that surface only because optional services aren't configured yet.
- ❌ Don't curl `localhost:8088` directly - use `azd ai agent invoke --local` so isolation headers, session reuse, and protocol detection are handled for you.
- ❌ Don't skip `azd provision`.

## Brownfield Workflow: Convert Existing Agent to Hosted Agent

Use this workflow when the user has an existing agent project that needs to be made compatible with Foundry hosted agent deployment. The required code change is wrapping the existing agent with the appropriate hosting adapter; `azd ai agent init` handles the surrounding Foundry scaffolding (`agent.yaml`, `azure.yaml`, `.agentignore`, `infra/`).

### Step B1: Analyze Existing Project

Scan the project to determine:

1. **Language** - Python (`requirements.txt`, `pyproject.toml`, `*.py`) or C# (`*.csproj`, `*.cs`).
2. **Framework** - identify which agent framework is in use:

| Indicator | Framework |
|-----------|-----------|
| Imports from `agent_framework` or `Microsoft.Agents.AI` | Microsoft Agent Framework |
| Imports from `langgraph`, `langchain` | LangGraph |
| No recognized framework imports, or other frameworks (e.g., Semantic Kernel, AutoGen, custom code) | Custom |

3. **Target protocol** - if the user has not specified one, infer whether the project should target `responses` or `invocations` based on the existing caller contract.
4. **Entry point** - identify the main script/entrypoint that creates and runs the agent.
5. **Agent object** - identify the agent instance that needs to be wrapped (e.g., a `BaseAgent` subclass, a compiled `StateGraph`, or an existing server/app).

### Step B2: Run `azd ai agent init` in the Existing Source Directory

`azd ai agent init` detects existing code in the working directory (the `init from code` mode) and prompts for:

- Foundry agent name (defaults to a sanitized directory name; pass `--agent-name` to override)
- Supported protocols (`responses`, `invocations`, or both)
- Deploy mode (**code-deploy ZIP** - default, available for Python and .NET projects - or **container**)
- Model configuration: use an existing model deployment from a Foundry project, deploy a new model from the catalog, or skip

```bash
cd <existing-agent-source-dir>
azd ai agent init --agent-name <unique-foundry-agent-name>
```

After it completes, the directory contains:

- `agent.yaml` - generated from your selections
- `azure.yaml` - added (or updated to include this agent service)
- `.agentignore` - controls which files are excluded from code-deploy ZIP packaging (uses `.gitignore` syntax)
- `infra/**` - Bicep for any required resources

> ⚠️ **Existing `agent.yaml`:** If the directory already has an `agent.yaml`, the CLI prompts to overwrite. In `--no-prompt` mode it fails fast rather than discarding your file.

### Step B3: Add Hosting Adapter Dependency

`azd ai agent init` does not install or wire the hosting adapter package - you do that. Pick the right adapter package for your framework + language + protocol from [references/hosting-adapter-packages.md](references/hosting-adapter-packages.md) and add it to the project's dependency file (`requirements.txt`, `pyproject.toml`, or `.csproj`). Pull the latest version from the package registry - do not hardcode versions.

### Step B4: Wrap Agent with Hosting Adapter

Modify the project's main entrypoint to wrap the existing agent with the adapter. Pattern by framework + protocol:

| Framework | Protocol | Language | How to wrap |
|-----------|----------|----------|-------------|
| Microsoft Agent Framework | `responses` | Python | Import `ResponsesHostServer`, pass the `agent_framework` agent, call `.run()` as default entrypoint |
| Microsoft Agent Framework | `invocations` | Python | Use `InvocationAgentServerHost()`, implement `@app.invoke_handler`, manage session state if multi-turn |
| Microsoft Agent Framework | `responses` | C# | Register Foundry responses hosting and map the `responses` protocol |
| Microsoft Agent Framework | `invocations` | C# | Register invocations services and an invocation handler; map the `invocations` protocol |
| LangGraph | either | Python | Follow the matching Foundry LangGraph template (`azd ai agent template list -o json`) for the selected protocol |
| Custom | either | Python or C# | Follow the matching custom template (`azd ai agent template list -o json`) for the selected language + protocol |

> ⚠️ **Warning:** The adapter MUST be the default entrypoint (no flags required to start). This is required for both `azd ai agent run` and containerized deployment.

### Step B5: Configure Environment Variables

1. Create or update a `.env` file with any non-reserved environment variables the agent code reads at runtime (model names, feature flags, third-party API keys, etc.). Do NOT add `FOUNDRY_*` or other reserved variables - see [references/reserved-env-vars.md](references/reserved-env-vars.md).
   - **If the agent uses tools / toolboxes:** resolve the toolbox endpoint per [references/use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint](references/use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint).
2. For Python, ensure the code uses `load_dotenv(override=False)` so Foundry-injected environment variables remain authoritative at runtime.
3. If the project calls Azure services, use `azure.identity.DefaultAzureCredential` for local development and `ManagedIdentityCredential` in production. See [auth-best-practices.md](../../references/auth-best-practices.md).

### Step B6: Optional - Add a Custom Dockerfile

`azd ai agent init` defaults to **code-deploy** (ZIP) for Python and .NET. A Dockerfile is **not required** in this mode - the platform builds and runs the container for you with a default base image.

Only add a Dockerfile when you need full image customization (custom system packages, non-standard runtimes, multi-language workloads). When you do: use an official base image, install dependencies, expose `8088`, set the adapter as `CMD`, build with `--platform linux/amd64`, and re-run `azd ai agent init` (or edit `agent.yaml`) to select container deploy mode.

### Step B7: Provision and Verify Locally

Run the same provision + run + invoke verification as the greenfield flow:

1. `azd provision` to create or update Foundry project, model deployment, and connected services.
2. `azd ai agent run` (background) to start the local server on `:8088`.
3. `azd ai agent invoke --local <payload>` from a separate shell. For brownfield, take the payload from the user's existing code (handler signatures, request schemas, test fixtures). If unclear, ask the user with `ask_user`.
4. Fix errors and retry until the request succeeds, then stop the local server.

## Common Guidelines

IMPORTANT: YOU MUST FOLLOW THESE.

Apply these to both greenfield and brownfield projects:

1. **Template-first** - Start from a real template surfaced by `azd ai agent template list`. Do not invent unsupported combinations, paths, or protocol behavior.

2. **`azd ai agent` is the recommended tooling** - Use the CLI commands listed in Quick Reference for create, run, and local invoke. Do NOT fall back to `az`, REST API calls (`api.github.com/...`), or MCP `foundry_*` tools in the create flow.

3. **Protocol consistency** - Keep the selected protocol consistent across template choice, code, `agent.yaml`, and verification (`azd ai agent invoke --local --protocol <p>`).

4. **Logging** - Implement proper logging using the language's standard logging framework (Python `logging` module, .NET `ILogger`). Hosted agents stream container stdout/stderr to Foundry, so all log output is visible via the troubleshoot workflow. Use structured log levels (INFO, WARNING, ERROR) and include context like request IDs and agent names.

5. **Framework-specific best practices** - When using Microsoft Agent Framework, read the [Agent Framework best practices](references/agentframework.md) for hosting adapter setup, credential patterns, and debugging guidance.

6. **Deploy handoff** - After the agent has been created, provisioned, and locally verified, explicitly tell the user that they can deploy the agent and ask them to say `deploy agent to foundry` to continue with the deploy sub-skill.

7. **Tool integration** - Hosted agents access tools through [Foundry Toolbox](references/use-toolbox-in-hosted-agent.md), NOT by wiring tools directly. If the user needs tools (web search, AI search, code execution, file search, MCP servers, etc.), follow the toolbox integration guide.

8. **Reserved environment variables** - The Foundry platform injects `FOUNDRY_*` and `AGENT_*` variables (plus `PORT`, `HOME`, `SSE_KEEPALIVE_INTERVAL`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `OTEL_EXPORTER_OTLP_ENDPOINT`) into every hosted agent container at startup. You MUST NOT generate, suggest, or configure any of these in `.env` files, `agent.yaml` `environment_variables`, or application code. User code may **read** runtime values like `FOUNDRY_PROJECT_ENDPOINT` from the environment but must not set them. For the full list and the local-dev mapping, see [references/reserved-env-vars.md](references/reserved-env-vars.md).

## Coding Tips

Use these when generating or modifying project code:

1. **Create a `.gitignore` file** - After generating code, create a `.gitignore` file if one does not already exist. If one already exists, update it as needed.
   - Choose the ignore entries based on the language, framework, and files generated.
   - Do not leave the project with no ignored files.
   - For Python projects, `.venv/` MUST be ignored at a minimum.

2. **`.agentignore` is separate from `.gitignore`** - `azd ai agent init` generates a `.agentignore` to control what is packaged into the code-deploy ZIP. Do not merge it into `.gitignore`; they serve different purposes.

## Non-Interactive / YOLO Mode

When running in non-interactive mode (e.g., YOLO mode), skip selection prompts and use these defaults unless the user has already specified otherwise:

- **Language** - `Python`
- **Protocol** - `responses`
- **Framework** - `Microsoft Agent Framework`

Drive `azd ai agent init` with `--no-prompt` plus explicit flags (`-m <manifest-url>`, `--agent-name`, `--protocol`, `--model` or `--model-deployment`, `--project-id`) to avoid interactive prompts.

If the user's request clearly requires another supported lane, use that lane instead of forcing the defaults.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `azd: command not found` | `azd` not installed | Install from https://aka.ms/azure-dev/install |
| `unknown command "ai"` | `azd ai` extension not installed | Install per https://aka.ms/azd-ai-agent-docs |
| `unknown command "template"` for `azd ai agent template list` | Subcommand not yet in the installed `azd ai` version | Fall back to interactive `azd ai agent init` and pick from the CLI's template picker; flag the gap to the user |
| `agent.yaml already exists; overwrite declined` | Re-running `azd ai agent init` in a directory that already has an `agent.yaml` | Either confirm overwrite when prompted, or edit the existing `agent.yaml` directly instead of re-running init |
| `azd ai agent init` cannot reach a manifest URL | Network error or stale template URL | Re-run `azd ai agent template list -o json` to get a current URL, then retry |
| Requested combination not supported (e.g., C# + LangGraph) | No template covers this lane | Explain the gap and switch to the nearest supported lane (e.g., C# + MAF or C# + Custom) |
| `azd provision` fails | Missing roles, quota, or invalid location | Review the Bicep error message; verify Azure permissions and model/region availability; rerun |
| `azd ai agent run` fails to start | Missing dependencies or wrong startup command | Check the project type was detected correctly; set `startupCommand` in `azure.yaml` or pass `--start-command` |
| `azd ai agent invoke --local` returns a protocol mismatch error | Code, `agent.yaml`, and invoke `--protocol` are not aligned | Make all three match the selected protocol |
| `azd ai agent invoke --local` returns 4xx with payload error | Payload shape doesn't match the agent's contract | Get the correct payload from the template README (greenfield) or the agent's request schema/handler signature (brownfield); ask the user if unclear |
| Dependency install fails | Version conflicts | Use versions from the template's own dependency file as a starting point |
