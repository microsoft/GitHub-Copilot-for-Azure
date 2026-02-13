# Copilot SDK Reference

Build apps powered by the Copilot SDK. Choose the scenario that fits your use case.

## Scenario Selection

| | Agent | Service |
|---|---|---|
| **Template** | `azd init --template jongio/copilot-sdk-agent` | `azd init --template jongio/copilot-sdk-service` |
| **Best for** | Multi-turn chat, Foundry agents, interactive UIs | API endpoints, scripts, one-shot processing, task automation |
| **Architecture** | API (Express/TS) + Web UI (React/Vite), 2 Container Apps | Varies — API server, CLI script, or standalone process |
| **Foundry** | ✅ AIProjectClient, threads, function tools, evaluation | ❌ Not needed |
| **Chat UI** | ✅ Included (React/Vite) | ❌ Optional or none |

## Documentation

| Resource | URL |
|----------|-----|
| Overview & Getting Started | https://github.com/github/copilot-sdk |
| Getting Started Guide | https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md |
| Node.js SDK | https://github.com/github/copilot-sdk/tree/main/nodejs |
| Python SDK | https://github.com/github/copilot-sdk/tree/main/python |
| Go SDK | https://github.com/github/copilot-sdk/tree/main/go |
| .NET SDK | https://github.com/github/copilot-sdk/tree/main/dotnet |
| Debugging | https://github.com/github/copilot-sdk/blob/main/docs/debugging.md |
| Compatibility | https://github.com/github/copilot-sdk/blob/main/docs/compatibility.md |

## Getting Current Examples

Use **context7** MCP tools as the PRIMARY way to get SDK documentation and code examples:

1. Call `context7-resolve-library-id` with `libraryName: "copilot-sdk"` to find the library ID
2. Call `context7-query-docs` with the resolved ID and a query matching the user's goal
3. Select the most relevant snippets for the user's scenario

> 💡 **Tip:** Fall back to `github-mcp-server-get_file_contents` with `owner: "github"`, `repo: "copilot-sdk"` to read files directly from the repo.

## Agent Scenario

For interactive, multi-turn agents with optional Azure AI Foundry integration.

**Quick start:** `azd init --template jongio/copilot-sdk-agent`, then follow the scaffolded README.

**Foundry integration:** Uses Azure AI Projects SDK — `AIProjectClient` for thread-based conversations, function tools, streaming with annotations/citations. Evaluate agents via `azure-ai-evaluation`.

**Auth:** `DefaultAzureCredential` for Foundry resources; `gh auth token` for Copilot SDK locally.

**Template customization:** Read `AGENTS.md` FIRST — it lists every source file with its purpose. Then:
1. Adapt the API — update routes, system message, and tool definitions
2. Build a custom UI — the template UI is just an example
3. Keep template infra — do NOT regenerate Dockerfile, Bicep, or `azure.yaml`

**Existing project:** See [Existing Project Integration](existing-project-integration.md) for adding Copilot SDK to your codebase.

## Service Scenario

For apps using the Copilot SDK for AI features without a full agent setup.

**Quick start:** `azd init --template jongio/copilot-sdk-service`, then follow the scaffolded README.

**Key patterns:**
- Use `sendAndWait` for one-shot requests (summarize, classify, extract)
- No chat UI needed — expose AI as API endpoints or run as scripts
- Optional streaming for longer responses
- Task automation via the ralph loop pattern (see [cookbook at github/awesome-copilot](https://github.com/github/awesome-copilot))

**Examples:** REST API with `/summarize` and `/classify` endpoints, CLI data processing scripts, automated content pipelines.

## Testing

| Scenario | Command |
|----------|---------|
| Agent | `azd app run` — opens API + UI locally |
| Service API | `curl -s http://localhost:3000/health` |
| Service endpoint | `curl -s -X POST http://localhost:3000/api/<endpoint> -H "Content-Type: application/json" -d '{"input":"test"}'` |

## BYOK (Bring Your Own Key)

Pass provider config when creating a session. Supported providers: `openai`, `azure-openai`, `anthropic`, `ollama`.

## Errors

| Error | Fix |
|-------|-----|
| `docker info` fails | Install Docker Desktop and start it |
| `gh auth token` fails | Run `gh auth login` then `gh auth refresh --scopes copilot` |
| `ECONNREFUSED` on JSON-RPC | Set autoStart or start CLI manually |
| `Model not available` | Check model name; for BYOK verify provider config |
| Session hangs | Set a max turns limit or add a hook to break |
