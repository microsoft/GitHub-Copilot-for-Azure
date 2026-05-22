# Brownfield: Convert Existing Agent

Part of the [create skill](../create-hosted.md).

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

> [!] **Existing `agent.yaml`:** If the directory already has an `agent.yaml`, the CLI prompts to overwrite. In `--no-prompt` mode it fails fast rather than discarding your file.

### Step B3: Add Hosting Adapter Dependency

`azd ai agent init` does not install or wire the hosting adapter package - you do that. Pick the right adapter package for your framework + language + protocol from [references/hosting-adapter-packages.md](./hosting-adapter-packages.md) and add it to the project's dependency file (`requirements.txt`, `pyproject.toml`, or `.csproj`). Pull the latest version from the package registry - do not hardcode versions.

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

> [!] **Warning:** The adapter MUST be the default entrypoint (no flags required to start). This is required for both `azd ai agent run` and containerized deployment.

### Step B5: Configure Environment Variables

1. Create or update a `.env` file with any non-reserved environment variables the agent code reads at runtime (model names, feature flags, third-party API keys, etc.). Do NOT add `FOUNDRY_*` or other reserved variables - see [references/reserved-env-vars.md](./reserved-env-vars.md).
   - **If the agent uses tools / toolboxes:** resolve the toolbox endpoint per [references/use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint](./use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint).
2. For Python, ensure the code uses `load_dotenv(override=False)` so Foundry-injected environment variables remain authoritative at runtime.
3. If the project calls Azure services, use `azure.identity.DefaultAzureCredential` for local development and `ManagedIdentityCredential` in production. See [auth-best-practices.md](../../../references/auth-best-practices.md).

### Step B6: Optional - Add a Custom Dockerfile

`azd ai agent init` defaults to **code-deploy** (ZIP) for Python and .NET. A Dockerfile is **not required** in this mode - the platform builds and runs the container for you with a default base image.

Only add a Dockerfile when you need full image customization (custom system packages, non-standard runtimes, multi-language workloads). When you do: use an official base image, install dependencies, expose `8088`, set the adapter as `CMD`, build with `--platform linux/amd64`, and re-run `azd ai agent init` (or edit `agent.yaml`) to select container deploy mode.

### Step B7: Provision and Verify Locally

Run the same provision + run + invoke verification as the greenfield flow:

1. `azd provision` to create or update Foundry project, model deployment, and connected services.
2. `azd ai agent run` (background) to start the local server on `:8088`.
3. `azd ai agent invoke --local <payload>` from a separate shell. For brownfield, take the payload from the user's existing code (handler signatures, request schemas, test fixtures). If unclear, ask the user with `ask_user`.
4. Fix errors and retry until the request succeeds, then stop the local server.
