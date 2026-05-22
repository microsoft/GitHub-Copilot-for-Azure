# Common Guidelines for Agent Creation

## Prerequisites

Verify before starting:

1. **`azd` installed** - run `azd version`. If missing: https://aka.ms/azure-dev/install
2. **`azd ai` extension installed** - run `azd ai agent version`. If `azd ai` is not recognized, install the AI extension per https://aka.ms/azd-ai-agent-docs.
3. **Signed in** - `azd auth login --check-status`; run `azd auth login` if needed.

## Cross-Cutting Notes

> [!] **Do NOT** call `az`, REST endpoints (`api.github.com/repos/...`), or MCP `foundry_*` tools from this workflow. Use the `azd ai agent` CLI commands listed in Quick Reference. If a needed `azd ai agent` subcommand is not yet installed, fall back to the interactive form of `azd ai agent init` and call out the gap to the user. (See [Common Guidelines](#common-guidelines) for the full set of guardrails.)

> [i] **Fallback:** If `azd ai agent template list` is not yet available in the installed `azd ai` extension, run `azd ai agent init` with no flags. The CLI presents an interactive template picker. Use that picker to choose a template, then continue with Step 5.

> [!] **Agent name uniqueness:** Foundry agents are unique by name within a project. Re-using a name creates a new **version** of the existing agent rather than a separate agent. Pass `--agent-name` when initializing from a reusable template to avoid collisions.

## Common Guidelines

IMPORTANT: YOU MUST FOLLOW THESE.

Apply these to both greenfield and brownfield projects:

1. **Template-first** - Start from a real template surfaced by `azd ai agent template list`. Do not invent unsupported combinations, paths, or protocol behavior.

2. **`azd ai agent` is the recommended tooling** - Use the CLI commands listed in Quick Reference for create, run, and local invoke. Do NOT fall back to `az`, REST API calls (`api.github.com/...`), or MCP `foundry_*` tools in the create flow.

3. **Protocol consistency** - Keep the selected protocol consistent across template choice, code, `agent.yaml`, and verification (`azd ai agent invoke --local --protocol <p>`).

4. **Logging** - Implement proper logging using the language's standard logging framework (Python `logging` module, .NET `ILogger`). Hosted agents stream container stdout/stderr to Foundry, so all log output is visible via the troubleshoot workflow. Use structured log levels (INFO, WARNING, ERROR) and include context like request IDs and agent names.

5. **Framework-specific best practices** - When using Microsoft Agent Framework, read the [references/agentframework.md](./agentframework.md) for hosting adapter setup, credential patterns, and debugging guidance.

6. **Deploy handoff** - After the agent has been created, provisioned, and locally verified, explicitly tell the user that they can deploy the agent and ask them to say `deploy agent to foundry` to continue with the deploy sub-skill.

7. **Tool integration** - Hosted agents access tools through [references/use-toolbox-in-hosted-agent.md](./use-toolbox-in-hosted-agent.md), NOT by wiring tools directly. If the user needs tools (web search, AI search, code execution, file search, MCP servers, etc.), follow the toolbox integration guide.

8. **Reserved environment variables** - The Foundry platform injects `FOUNDRY_*` and `AGENT_*` variables (plus `PORT`, `HOME`, `SSE_KEEPALIVE_INTERVAL`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `OTEL_EXPORTER_OTLP_ENDPOINT`) into every hosted agent container at startup. You MUST NOT generate, suggest, or configure any of these in `.env` files, `agent.yaml` `environment_variables`, or application code. User code may **read** runtime values like `FOUNDRY_PROJECT_ENDPOINT` from the environment but must not set them. For the full list and the local-dev mapping, see [references/reserved-env-vars.md](./reserved-env-vars.md).

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
