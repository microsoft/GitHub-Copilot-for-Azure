# Existing Project Integration

Add Copilot SDK agent capabilities to an existing application.

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

Use MCP tools to read the template's implementation for the detected language:

1. Call `github-mcp-server-get_file_contents` with `owner: "jongio"`, `repo: "copilot-sdk-agent"` to browse the template
2. Read `AGENTS.md` first — it maps every source file to its purpose
3. Focus on: session creation, tool definitions, API route handlers, middleware

Use context7 tools (`context7-resolve-library-id` → `context7-query-docs`) to get current SDK API examples.

## Integration Steps

1. **Add SDK dependency** — install the package for the project's language:

| Language | Package |
|----------|---------|
| Node.js | `@github/copilot-sdk` |
| Python | `github-copilot-sdk` |
| Go / .NET | See SDK repo for equivalent |

2. **Create agent endpoint** — add a route (e.g., `/api/agent` or `/api/chat`) that creates a Copilot session and handles streaming responses. Adapt to the app's existing routing pattern (Express router, FastAPI route, etc.)

3. **Define tools** — create tool definitions exposing the app's domain logic to the agent. Each tool needs a name, description, and handler function.

4. **Configure authentication** — use `gh auth token` for local dev; for production, use Key Vault.

5. **Wire into existing app** — register the new route with the existing server/app instance. Do NOT create a separate server.

> ⚠️ **Warning:** Do not duplicate server startup logic. Add the agent route to the existing app instance.

## BYOK Support

If the user has their own model provider, pass provider config when creating a session.

| Provider | Config key |
|----------|-----------|
| OpenAI | `openai` |
| Azure OpenAI | `azure-openai` |
| Anthropic | `anthropic` |
| Ollama | `ollama` |

## Testing

Run the existing dev server and test the new agent endpoint:

```bash
curl -s -X POST http://localhost:<port>/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

## Errors

| Error | Fix |
|-------|-----|
| SDK not found | Verify dependency installed and import path correct |
| Auth fails locally | Run `gh auth login` then `gh auth refresh --scopes copilot` |
| Route conflicts | Ensure agent endpoint path doesn't collide with existing routes |
| Missing tools | Verify tool definitions are registered with the session |
| Session hangs | Set a max turns limit or add a hook to break |
