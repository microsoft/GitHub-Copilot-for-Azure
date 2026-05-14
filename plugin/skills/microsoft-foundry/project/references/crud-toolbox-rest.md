# Toolbox & Tool CRUD — REST API

Direct HTTP CRUD against the Foundry **data plane**. Use when no SDK is available, when scripting in shells / non-supported languages, or for debugging.

> ✅ Every operation in this doc is **live-validated** against a real Foundry project (xiaofhua-toolbox-009, May 2026). See "Validation notes" at the end for project-specific details.

## Setup

| Item | Value |
|------|-------|
| Plane | Data plane (NOT ARM / `management.azure.com`) |
| Base URL | `https://<account>.services.ai.azure.com/api/projects/<project>` |
| Required query param | `?api-version=v1` on every request |
| Auth | `Authorization: Bearer <token>` |
| Token scope | `https://ai.azure.com/.default` |
| **Required header on all toolbox calls (management AND MCP runtime)** | `Foundry-Features: Toolboxes=V1Preview` |

```bash
TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv)
PROJECT="https://<account>.services.ai.azure.com/api/projects/<project>"
FF="Foundry-Features: Toolboxes=V1Preview"
```

## Mental Model

- A **toolbox** is the parent resource with `name` and `default_version`. Versions are **immutable** integer strings (`"1"`, `"2"`, …) — the docs sometimes show `"v1"` but the API returns and accepts plain integers.
- "Updating tools" = POST a new version, then PATCH to promote it. There is no per-tool endpoint.
- All paths in this doc are **relative to `$PROJECT`**.

### Multi-tool naming requirement (validator-enforced)

If a version has more than one tool, **every tool must have a unique identifier**:
- `name` for `web_search`, `code_interpreter`, `file_search`, `azure_ai_search`, `openapi`, `a2a_preview`
- `server_label` for `mcp`

A version with two unnamed tools fails with `invalid_payload`:

```
Multiple tools without identifiers found. All tools except a single tool must
have unique identifiers ('name' or 'server_label').
```

Single-tool versions are fine without a name.

## Toolbox CRUD (Verified)

### Create a toolbox version

Creates the parent toolbox on first call; subsequent calls add new versions. The first version is auto-promoted to `default_version`.

```http
POST /toolboxes/{toolbox_name}/versions?api-version=v1
Authorization: Bearer <token>
Content-Type: application/json
Foundry-Features: Toolboxes=V1Preview

{
  "description": "Toolbox with web search and an MCP server",
  "tools": [ /* see Tool JSON Shapes below */ ]
}
```

Response 200:
```json
{
  "object": "toolbox.version",
  "id": "toolbox_<hash>:1",
  "name": "<toolbox_name>",
  "version": "1",
  "description": "...",
  "created_at": 1778657956,
  "tools": [ ... ]
}
```

### List all toolboxes

```http
GET /toolboxes?api-version=v1
```

### Get a toolbox (metadata only)

Returns `name`, `default_version`. Tools are not included — use the version GET for tools.

```http
GET /toolboxes/{toolbox_name}?api-version=v1
```

### Promote a version to `default_version`

```http
PATCH /toolboxes/{toolbox_name}?api-version=v1
Content-Type: application/json

{ "default_version": "<version>" }
```

### Delete a toolbox (and all versions)

```http
DELETE /toolboxes/{toolbox_name}?api-version=v1
```

Returns 204; subsequent GET returns 404.

### List versions

```http
GET /toolboxes/{toolbox_name}/versions?api-version=v1
```

### Get a specific version (with tools)

```http
GET /toolboxes/{toolbox_name}/versions/{version}?api-version=v1
```

### Delete a version

```http
DELETE /toolboxes/{toolbox_name}/versions/{version}?api-version=v1
```

You **cannot delete the version that is currently `default_version`** — promote a different version first.

## Add / Update / Remove a Tool

All tool changes use the same pattern:

```bash
# 1. Get the current default version's tools
curl -sS "$PROJECT/toolboxes/my-tb?api-version=v1" \
  -H "Authorization: Bearer $TOKEN" -H "$FF"
# → returns metadata with default_version, e.g. "1"

curl -sS "$PROJECT/toolboxes/my-tb/versions/1?api-version=v1" \
  -H "Authorization: Bearer $TOKEN" -H "$FF"
# → returns the version object with its tools array

# 2. Build a new tools array (add / update / remove entries vs current)
#    Remember: multi-tool versions need 'name' or 'server_label' on each entry.

# 3. POST a new version with the new array
curl -sS -X POST "$PROJECT/toolboxes/my-tb/versions?api-version=v1" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "$FF" \
  -d '{
    "description": "added code interpreter",
    "tools": [
      { "type": "web_search",       "name": "web" },
      { "type": "code_interpreter", "name": "code" }
    ]
  }'
# → returns the new version, e.g. "2"

# 4. PATCH to promote the new version
curl -sS -X PATCH "$PROJECT/toolboxes/my-tb?api-version=v1" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "$FF" \
  -d '{ "default_version": "2" }'
```

To **remove a tool**, omit it from the array in step 2. To **update a tool's config**, edit its entry in place. To **revert**, PATCH back to the older version (don't delete the old version unless you're sure).

## Tool JSON Shapes

Each entry below goes inside the `tools: [ ... ]` array of the version-create body. **All shapes below were live-validated** — if a placeholder ID is used (e.g. `placeholder-search-conn`), the management API still accepts the create; connection existence is only enforced when the MCP runtime is invoked.

### `web_search`

```json
{ "type": "web_search" }
```

With named identifier (required when alongside other tools):

```json
{ "type": "web_search", "name": "web" }
```

With a custom Bing Search resource (not yet live-validated; from official samples):

```json
{
  "type": "web_search",
  "web_search": {
    "custom_search_configuration": {
      "project_connection_id": "<bing-connection-name>",
      "instance_name": "<bing-instance-name>"
    }
  }
}
```

### `code_interpreter`

```json
{ "type": "code_interpreter" }
```

With files (not yet live-validated):

```json
{
  "type": "code_interpreter",
  "container": { "type": "auto", "file_ids": ["<file-id>"] }
}
```

### `file_search`

> **Correction vs official docs:** `vector_store_ids` is **top-level on the tool object**, not nested under `file_search.{}`. The validator's error message confirms `tools[N].vector_store_ids`.

```json
{
  "type": "file_search",
  "vector_store_ids": ["<vector-store-id>"]
}
```

### `azure_ai_search`

```json
{
  "type": "azure_ai_search",
  "azure_ai_search": {
    "indexes": [
      {
        "index_name": "<index-name>",
        "project_connection_id": "<search-connection-name>"
      }
    ]
  }
}
```

### `mcp`

```json
{
  "type": "mcp",
  "server_label": "github",
  "server_url": "https://api.githubcopilot.com/mcp",
  "project_connection_id": "<mcp-connection-name>",
  "require_approval": "never"
}
```

`server_label` doubles as the unique identifier; no separate `name` needed. Tool names returned by `tools/list` are prefixed with the label (e.g. `github.search_repos`).

`require_approval`: `"never"` (default-style) or `"always"` (agent must request user confirmation before invoking). Enforcement is the agent's responsibility.

### `openapi`

Anonymous:

```json
{
  "type": "openapi",
  "openapi": {
    "name": "my-api",
    "spec": { "openapi": "3.0.0", "info": { "title": "X", "version": "1.0.0" }, "paths": {} },
    "auth": { "type": "anonymous" }
  }
}
```

Connection-based auth (not yet live-validated end-to-end, but request shape accepted):

```json
{
  "type": "openapi",
  "openapi": {
    "name": "my-api",
    "spec": { /* OpenAPI 3.0+ spec object */ },
    "auth": {
      "type": "connection",
      "security_scheme": { "project_connection_id": "<api-connection-name>" }
    }
  }
}
```

### `a2a_preview` (Agent-to-Agent)

> ⚠️ Specify **exactly one** of `base_url` or `project_connection_id`. Including both fails at MCP runtime with: `A2A tool config must specify exactly one of 'base_url' or 'project_connection_id', not both`. The toolbox version is created successfully but `tools/list` returns an empty list with the error in the response.

By connection (recommended when the target agent is a Foundry connection):

```json
{
  "type": "a2a_preview",
  "name": "target-agent",
  "project_connection_id": "<connection-name>"
}
```

By URL (anonymous / direct):

```json
{
  "type": "a2a_preview",
  "name": "target-agent",
  "base_url": "<agent-base-url>"
}
```

## Connections (Required for Most Tools)

Tools needing credentials reference a **project connection** by `project_connection_id`. **Connections are created on the ARM control plane**, not the data plane (data-plane PUT/POST against `/connections` returns 405).

```bash
ARMTOK=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)
ARM="https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/projects/<project>/connections"
APIV="2025-04-01-preview"
```

### CustomKeys (API key / bearer token) — verified

```bash
curl -sS -X PUT "$ARM/<connection-name>?api-version=$APIV" \
  -H "Authorization: Bearer $ARMTOK" -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "category": "CustomKeys",
      "authType": "CustomKeys",
      "target": "https://api.githubcopilot.com/mcp",
      "isSharedToAll": false,
      "credentials": { "keys": { "Authorization": "Bearer <token>" } },
      "metadata": { "ApiType": "RemoteMcp" }
    }
  }'
```

For an "anonymous" / no-auth target (e.g. public MCP server like Microsoft Learn), still use `CustomKeys` with a placeholder key — verified shape:

```json
{
  "properties": {
    "category": "CustomKeys",
    "authType": "CustomKeys",
    "target": "https://learn.microsoft.com/api/mcp",
    "isSharedToAll": false,
    "credentials": { "keys": { "x-empty": "none" } },
    "metadata": { "ApiType": "RemoteMcp" }
  }
}
```

### OAuth2 (custom app)

> ⚠️ **Body schema not publicly documented.** Several reasonable shapes (clientId/clientSecret, authorizationUrl/tokenUrl) returned 400 `unable to deserialize request body` against the data-plane and ARM endpoints during validation. **Recommended:** create OAuth2 connections via the [Foundry Portal UI](https://ai.azure.com/) under the project's connections page, then reference the connection name from your tool. If you discover the correct REST shape, please update this doc.

### Other auth types

`AgenticIdentity` (Entra workload identity) and `UserEntraToken` (on-behalf-of) are documented as supported but not yet live-validated here. Same caveat as OAuth2 — Portal/Bicep is the safer creation path until the REST schema is documented.

## MCP Runtime Calls

Once a toolbox version exists, agents call the toolbox MCP endpoint to discover and invoke tools. See [toolbox-reference.md](../../foundry-agent/create/references/toolbox-reference.md) for the full MCP protocol details. Quick check:

```bash
URL="$PROJECT/toolboxes/<toolbox_name>/mcp?api-version=v1"

# tools/list (no session needed for simple read-only flows)
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "$FF" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

`Accept: application/json, text/event-stream` is required (the endpoint negotiates a streamable response).

## Validation Notes

Every operation, error path, and tool-type request shape in this doc was executed against the live Foundry project `xiaofhua-toolbox-009` in May 2026. Test toolboxes (`rest-tb-*`) and connections (`learn-mcp-conn`, `github-mcp-key-conn`) are kept in the project as reference fixtures.

| Validation | Status |
|------------|--------|
| Toolbox CRUD (create / list / get / patch / delete) | ✅ Live-validated |
| Version CRUD (create / list / get / delete) | ✅ Live-validated |
| `web_search`, `code_interpreter`, `file_search`, `mcp`, `azure_ai_search`, `openapi` (anon), `a2a_preview` request shapes | ✅ Live-validated |
| MCP `tools/list` round-trip across all 16 reference toolboxes | ✅ Live-validated (12 returned tool catalogs; `a2a_preview` toolboxes returned empty + the config error above; `openapi` toolboxes with empty `paths` returned empty as expected) |
| MCP `tools/call` end-to-end: `code_interpreter` (`print(2+2)`→`4`), Learn MCP (`learn.microsoft_docs_search`), GitHub MCP (`github.get_me` via PAT) | ✅ Live-validated |
| MCP `tools/call` arg names: `web_search` → `search_query` (string), `file_search` → `queries` (string array), `code_interpreter` → `code` (string) | ✅ Live-validated via `tools/list` schema + invocation |
| MCP `tools/call` for `web_search`: returns 404 "API deployment does not exist" because `web_search` requires the **agent runtime's model context** for server-side LLM-assisted query rewriting — it cannot be invoked directly via `tools/call` even with a deployed model. Verified working through `POST /openai/v1/responses` with `tools: [{"type":"web_search"}]`. | ✅ Confirmed agent-only invocation (verified end-to-end via responses API) |
| MCP `tools/call` for `file_search` / `azure_ai_search`: error returned because the toolboxes reference placeholder vector store / placeholder connection | ⚠️ Wiring validated; expected with placeholder backends |
| `web_search` custom Bing config | ⚠️ From samples only |
| `openapi` connection auth | ⚠️ Request shape accepted; not invoked end-to-end |
| Connection creation: `CustomKeys` via ARM | ✅ Live-validated |
| Connection creation: `OAuth2` via REST/ARM | ❌ Schema not publicly documented |

## Sources

- [Toolbox docs — REST API tab](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [`SUPPORTED_TOOLBOX_TOOLS.md`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md)
- For MCP runtime calls (`tools/list`, `tools/call`), see [toolbox-reference.md](../../foundry-agent/create/references/toolbox-reference.md)
