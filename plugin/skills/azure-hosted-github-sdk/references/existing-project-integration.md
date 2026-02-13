# Integrating Copilot SDK into Existing Projects

Add Copilot SDK AI features to an existing application. Two integration scenarios:

| Scenario | Use case | Key pattern |
|----------|----------|-------------|
| **Agent** | Interactive chat with tools, multi-turn sessions | Streaming endpoint, tool definitions |
| **Service** | AI processing (summarize, classify), background scripts | `sendAndWait`, one-shot completions, no chat UI |

## Project Analysis

Detect the project type by scanning for indicator files:

| Indicator | Language | Framework hints |
|-----------|----------|-----------------|
| `package.json` | Node.js | Express, Fastify, Next.js |
| `requirements.txt` / `pyproject.toml` | Python | Flask, FastAPI, Django |
| `go.mod` | Go | Gin, Echo, net/http |
| `*.csproj` / `*.sln` | .NET | ASP.NET, Minimal API |

Also check for existing web frameworks, API routes, and middleware patterns.

## Study Template Patterns

Use MCP tools to read template implementations for the detected language:

- **Agent template:** Call `github-mcp-server-get_file_contents` with `owner: "jongio"`, `repo: "copilot-sdk-agent"`. Focus on session creation, tool definitions, streaming handlers.
- **Service template:** Call `github-mcp-server-get_file_contents` with `owner: "jongio"`, `repo: "copilot-sdk-service"`. Focus on `sendAndWait` calls, one-shot completions.
- Read `AGENTS.md` first in each repo — it maps every source file to its purpose.

Use context7 tools (`context7-resolve-library-id` → `context7-query-docs`) for current SDK API examples. See [copilot-sdk.md](copilot-sdk.md) for full SDK reference.

## Integration Steps

### 1. Add SDK dependency

| Language | Package |
|----------|---------|
| Node.js | `@github/copilot-sdk` |
| Python | `github-copilot-sdk` |
| Go / .NET | See SDK repo for equivalent |

### 2. Create Copilot endpoint

- **Agent path:** Add a route (e.g., `/api/chat`) that creates a session with streaming responses. Define tools exposing domain logic — each tool needs a name, description, and handler. Support multi-turn sessions.
- **Service path:** Add a route (e.g., `/api/summarize`) or background script that uses `sendAndWait` for one-shot completions. No chat UI or tool definitions needed.

Adapt to the app's existing routing pattern (Express router, FastAPI route, etc.).

### 3. Configure authentication

Use `gh auth token` for local dev; for production, use Key Vault.

### 4. Wire into existing app

Register the new route with the existing server/app instance. Do NOT create a separate server.

> ⚠️ **Warning:** Do not duplicate server startup logic. Add the Copilot route to the existing app instance.

## BYOM Support

If the user has their own model provider, pass provider config when creating a session. For Azure endpoints, use `DefaultAzureCredential` from `@azure/identity` to get a `bearerToken` — never use API keys.

| Provider | Config type | Auth |
|----------|-----------|------|
| Azure OpenAI / Foundry | `openai` or `azure` | `bearerToken` via `DefaultAzureCredential` |
| OpenAI | `openai` | `apiKey` |
| Anthropic | `anthropic` | `apiKey` |
| Ollama | `ollama` | none |

## Testing

Run the existing dev server and test the new endpoint:

```bash
# Agent endpoint
curl -s -X POST http://localhost:<port>/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# Service endpoint
curl -s -X POST http://localhost:<port>/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"content to summarize"}'
```

## Errors

| Error | Fix |
|-------|-----|
| SDK not found | Verify dependency installed and import path correct |
| Auth fails locally | Run `gh auth login` then `gh auth refresh --scopes copilot` |
| Route conflicts | Ensure endpoint path doesn't collide with existing routes |
| Missing tools | (Agent only) Verify tool definitions are registered with the session |
| Session hangs | (Agent only) Set a max turns limit or add a hook to break |
