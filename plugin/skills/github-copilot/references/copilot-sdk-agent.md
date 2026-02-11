# Copilot SDK Agent Reference

Build an agent powered by the Copilot SDK and deploy it to Azure.

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

1. Call `context7-resolve-library-id` with `libraryName: "copilot-sdk"` to find the Context7-compatible library ID
2. Call `context7-query-docs` with the resolved library ID and a query matching the user's goal (e.g., "how to create an agent", "hook examples") to get current code examples in the user's preferred language
3. Browse results and select the most relevant snippets for the user's scenario

> 💡 **Tip:** If context7 does not return what you need, fall back to `github-mcp-server-get_file_contents` with `owner: "github"`, `repo: "copilot-sdk"` to read files directly from the repo (README, `docs/getting-started.md`, language folders like `nodejs/`, `python/`, `go/`, `dotnet/`).

## Quick Start

- **New project:** Run `azd init --template jongio/copilot-sdk-agent`, then follow the scaffolded README for setup.
- **Existing project:** Use the template as a reference — browse its source with `github-mcp-server-get_file_contents` (`owner: "jongio"`, `repo: "copilot-sdk-agent"`) and adapt the patterns into your codebase.

## Template Customization

Read the scaffolded source (especially `AGENTS.md`) and adapt to the user's scenario:

1. **Build a custom UI** — the template UI is just an example; most scenarios are NOT chat
2. **Adapt the API** — update routes, system message, and tool definitions for the user's domain
3. **Keep template infra** — do NOT regenerate Dockerfile, Bicep, or `azure.yaml`

## Testing

Run `azd app run` to test locally. Adapt the template's UI rather than creating separate test pages. Use **playwright** MCP tools (`playwright-browser_navigate`, `playwright-browser_snapshot`, `playwright-browser_click`, etc.) for automated browser-based testing of the running app.

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
