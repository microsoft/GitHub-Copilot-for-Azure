# Greenfield: Create New Hosted Agent

Part of the [create skill](../create-hosted.md).

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

> [!] **Warning:** LangGraph is Python-only. For C# + LangGraph, suggest Microsoft Agent Framework or Custom instead.

If the user has no specific preference, suggest **Python + `responses` + Microsoft Agent Framework** as defaults.

In non-interactive or YOLO mode, use those same defaults unless the user's request clearly requires another supported combination.

### Step 3: Discover and Select a Template

List the available Foundry agent templates:

```bash
azd ai agent template list -o json
```

Each template entry includes metadata (language, protocols, framework, tags) and a ready-to-run init command (typically `azd ai agent init -m <manifest-url>`). Match the user's intent (language, protocol, framework, and any specific use case such as RAG, tools, multi-agent, HITL) against the template list and pick the closest match.

If the user specified what the agent should do, pick the single best matching template directly. Otherwise, present the candidate templates to the user and let them choose.

> [!] **Tools:** Hosted agents access tools through a **Foundry Toolbox** endpoint - they do NOT wire tools directly. If the user wants an agent with tools (web search, AI search, code interpreter, MCP servers, etc.), prefer toolbox-enabled templates. See [references/use-toolbox-in-hosted-agent.md](./use-toolbox-in-hosted-agent.md) for the toolbox integration pattern and how to resolve a toolbox endpoint.

> [i] **Fallback:** If `azd ai agent template list` is not yet available in the installed `azd ai` extension, run `azd ai agent init` with no flags. The CLI presents an interactive template picker. Use that picker to choose a template, then continue with Step 5.

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

> [!] **Agent name uniqueness:** Foundry agents are unique by name within a project. Re-using a name creates a new **version** of the existing agent rather than a separate agent. Pass `--agent-name` when initializing from a reusable template to avoid collisions.

### Step 5: Customize and Implement

1. Read the template's `README.md` (linked from the template list entry) and the generated `agent.yaml` to understand structure, required env vars, and any tool/toolbox setup.
2. Read the scaffolded code to understand patterns, protocol handling, and dependencies used.
3. If using Microsoft Agent Framework, follow the best practices in [references/agentframework.md](./agentframework.md).
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
- [x] Real `azd provision` -> `azd ai agent run` -> `azd ai agent invoke --local` cycle - do not fake it.
- [x] Stop the local server after verification.
- [x] Ignore Azure-side auth/connection errors that surface only because optional services aren't configured yet.
- [!] Don't curl `localhost:8088` directly - use `azd ai agent invoke --local` so isolation headers, session reuse, and protocol detection are handled for you.
- [!] Don't skip `azd provision`.
