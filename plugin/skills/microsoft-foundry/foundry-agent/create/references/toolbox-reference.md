# Toolbox Reference

Endpoint format, MCP protocol details, authentication, OAuth consent handling, endpoint testing, citation pattern, and troubleshooting for Foundry Toolboxes.

## Endpoint Format

The toolbox MCP endpoint is constructed from the **project endpoint** + **toolbox name**:

| Endpoint | URL |
|----------|-----|
| Latest version (default) | `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1` |
| Specific version | `{project_endpoint}/toolboxes/{toolbox_name}/versions/{version}/mcp?api-version=v1` |

- **Project endpoint** format: `https://<account>.services.ai.azure.com/api/projects/<project>`
- The latest-version endpoint always serves the toolbox's `default_version`.
- Use the specific-version endpoint to test a version before promoting it.
- **Required header** on every request: `Foundry-Features: Toolboxes=V1Preview`
- `?api-version=v1` query parameter is **required** — requests without it return HTTP 400.

### Agent env contract

Hosted agents read the MCP endpoint from a single environment variable. The canonical name is **`TOOLBOX_ENDPOINT`** — use it in all new code and `.env` files:

```
# Latest version (recommended for prod):
TOOLBOX_ENDPOINT=https://{host}/api/projects/{project}/toolboxes/{toolbox_name}/mcp?api-version=v1

# Pinned to a specific version (recommended for testing a new version before promoting):
TOOLBOX_ENDPOINT=https://{host}/api/projects/{project}/toolboxes/{toolbox_name}/versions/{version}/mcp?api-version=v1
```

> Some older samples use `FOUNDRY_TOOLBOX_ENDPOINT` — treat that as **legacy**. New code should read `TOOLBOX_ENDPOINT`; only fall back to the legacy name when maintaining an existing sample that already wires it.

## MCP Protocol

Toolboxes use **Model Context Protocol (MCP)** — JSON-RPC 2.0 over HTTP POST:

- **`initialize`** — Handshake to establish an MCP session. Returns a `mcp-session-id` header to include in subsequent requests.
- **`tools/list`** — Returns all available tools with names, descriptions, and input schemas.
- **`tools/call`** — Invokes a tool with arguments and returns structured results.

> `prompts/list` is **not supported** by the toolbox endpoint. Always pass `load_prompts=False` to MCP client constructors.

### Tool naming

Tools sourced from a remote MCP server (`type: mcp`) are exposed as `{server_label}.{tool_name}` (e.g. `myserver.get_info`). When calling them via `tools/call`, you must use the prefixed name. Built-in tool types (`web_search`, `file_search`, `azure_ai_search`, `code_interpreter`) keep their canonical names.

## Authentication

- **Agent → Toolbox:** Azure AD bearer token with scope `https://ai.azure.com/.default`, refreshed on every request.
- **Toolbox → External Services:** Managed by the platform via project connections (API keys, OAuth, managed identity). See [foundry-tool-catalog.md](foundry-tool-catalog.md) for the connection shapes that back each tool type.

> ⚠️ Do **not** use scope `https://cognitiveservices.azure.com/.default`. The toolbox MCP endpoint rejects it with HTTP 401.

## OAuth Consent Handling

When a toolbox includes an OAuth-based MCP connection (e.g., GitHub OAuth), the **first** call from a new user triggers a `CONSENT_REQUIRED` error (MCP error code `-32006`). The error message contains the consent URL. This error can surface on either `initialize` or `tools/call` depending on when the server discovers the missing grant.

**Agent code must handle this:**
1. Catch MCP error code `-32006` from `tools/call` **or** during MCP session initialization.
2. Extract the consent URL from the error message.
3. Log the URL and surface it to the user (e.g., print to stdout or return in the agent response).
4. After the user completes the OAuth flow in a browser, retry the call — subsequent calls succeed without re-prompting.

> This is a one-time flow per user per OAuth connection in a project. The agent should not silently swallow this error.

## Multi-Tool Toolbox Constraint

A single toolbox can combine multiple tools, but **at most one tool per unnamed tool type**. Tools like `web_search`, `file_search`, `azure_ai_search`, and `code_interpreter` have no identifier; MCP tools must each have a unique `server_label`.

If you include two unnamed tools of the same type (or two MCP tools with the same `server_label`), the API returns:

```
400 invalid_payload: Multiple tools without identifiers found...
```

Valid combinations include:

- `file_search` + one or more `mcp` (each with unique `server_label`)
- `web_search` + one or more `mcp`
- `azure_ai_search` + one or more `mcp`

## Azure AI Search Citation Pattern

When calling an `azure_ai_search` tool through the toolbox MCP endpoint, citation metadata is returned under `result.structuredContent.documents[]` — **not** in a separate `citations` array. Treat each document as one citation:

| Field | Meaning |
|-------|---------|
| `title` | Citation display text |
| `url` | Source link |
| `id` | Source identifier |
| `score` | Retrieval relevance score |
| `knowledgeSourceIndex` | Source grouping / index |

Verification checklist:

1. `tools/list` returns the tool name `azure_ai_search`.
2. `tools/call` succeeds with a `query` argument.
3. `result.structuredContent.documents` is present and non-empty.
4. At least one document has both `title` and `url`.

## Testing the Toolbox Endpoint

Before running the full agent, verify the toolbox MCP endpoint works end-to-end. Use `az login` for authentication, then test the three MCP operations in order:

**1. Get a bearer token:**
```bash
TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv)
TOOLBOX_URL="https://<account>.services.ai.azure.com/api/projects/<project>/toolboxes/<name>/mcp?api-version=v1"
```

**2. Initialize MCP session:**
```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Foundry-Features: Toolboxes=V1Preview" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"debug","version":"1.0.0"}}}' \
  -D - | head -20
```
Save the `mcp-session-id` header from the response for subsequent calls.

**3. List tools:**
```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Foundry-Features: Toolboxes=V1Preview" \
  -H "mcp-session-id: <session-id-from-step-2>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq .
```

**Checklist:**
- Response contains `result.tools[]` with `len > 0`
- Each tool has `name`, `description`, and `inputSchema` with a `properties` field
- MCP tool names for remote servers are prefixed with `server_label` (e.g., `myserver.get_info`)

**4. Call a tool (optional):**
```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Foundry-Features: Toolboxes=V1Preview" \
  -H "mcp-session-id: <session-id-from-step-2>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"<tool_name>","arguments":{"query":"test"}}}' | jq .
```

> For a Python-based debug client, see the `_McpToolboxClient` class in the [BYO toolbox sample `main.py`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/bring-your-own/responses/bring-your-own-toolbox/main.py) — it implements `initialize`, `list_tools`, and `call_tool` using raw `httpx` calls.

## Troubleshooting

| Error | Cause | Resolution |
|-------|-------|------------|
| CONSENT_REQUIRED (code -32006) | OAuth MCP connection needs user consent | Open consent URL in browser, complete OAuth flow, retry |
| 401 on MCP calls | Expired token or wrong scope | Use scope `https://ai.azure.com/.default` (not `cognitiveservices`) and refresh token on every request |
| 400 `invalid_payload: Multiple tools without identifiers found` | Two unnamed tools of the same type (or duplicate `server_label`) in one toolbox | Keep at most one unnamed tool per type; give each MCP tool a unique `server_label` |
| `tools/list` returns 0 tools | Toolbox version still provisioning, or tool type not yet available in the region | Wait ~10s and retry; try a different region |
| Tool not found on `tools/call` | Missing `server_label.` prefix for MCP-sourced tools | Call as `{server_label}.{tool_name}` |
| 500 on `prompts/list` | Not supported by toolbox endpoint | Pass `load_prompts=False` to MCP client constructor |
| 500 with non-streaming `tools/call` | Non-streaming not supported | Always use `stream=True` for toolbox MCP tools |
| 400 missing `api-version` | Query string dropped | Append `?api-version=v1` to every toolbox URL |
| 403 on `POST /toolboxes` | Caller lacks `Azure AI Developer` or `Cognitive Services Contributor` on the project | Grant the role on the project scope |
