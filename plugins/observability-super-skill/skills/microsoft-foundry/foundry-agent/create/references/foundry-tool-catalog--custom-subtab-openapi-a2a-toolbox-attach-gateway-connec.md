# Selected guidance: Custom subtab — OpenAPI / A2A; Toolbox attach — `gateway_connector` tool naming; `outlook` connector — verified end-to-end (2026-05-22); Min

> Reading grants no execution approval. Apply current-request intent and
> standalone availability gates. Analyze supplied evidence in memory without
> Azure/Python, installs, auth, cache, writes or jobs. Missing/denied/empty/
> partial evidence stays distinct; insufficient evidence is INCONCLUSIVE.
> Live reads need verified operations/schemas, approved scope/window and finite
> budgets. Lifecycle actions, sensitive content, traffic, persistence, edits
> and deployment need separate explicit approval. Retain prerequisites from
> reached steps; missing prerequisites block operations. These rules supersede
> conflicting automatic actions in retained examples.

[Execution boundaries](../../../references/execution-boundaries.md) apply to the selected action.

## Custom subtab — OpenAPI / A2A

Not catalog-driven — the user provides the spec themselves. Each Save in this subtab maps to a single PUT against the same connections endpoint:

| Tile | `authType` options | `target` | Notes |
|---|---|---|---|
| OpenAPI | `None`, `CustomKeys`, `ApiKey`, `OAuth2` | OpenAPI spec URL or upstream API base | Agent gets `tools[].openapi.auth.security_scheme.connection_id`. |
| A2A (Preview) | `None` / `CustomKeys` / `UserEntraToken` / `AAD` (mapped from UI) | A2A endpoint | `metadata.agentCardPath` default `/.well-known/agent-card.json`; agent gets `tools=[A2APreviewTool(project_connection_id=...)]`; runtime emits `a2a_preview_call` / `a2a_preview_call_output` events. |
| MCP | covered above | — | This tile is just a router to the catalog / BYO flows. |

## Toolbox attach — `gateway_connector` tool naming

Attach the same as `generic_mcp` — the tool block uses `type:"mcp"` and `project_connection_id` set to the **full ARM resource id** of the connection (NOT just the name):

```jsonc
{
  "tools": [{
    "type": "mcp",
    "server_label": "box5",
    "project_connection_id":
      "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{acct}/projects/{proj}/connections/{connName}"
  }]
}
```

`tools/list` returns one MCP tool per registered operation. Tool names follow the verified pattern (probed 2026-05-22 against Box):

```
<server_label>___<connectorName>_<OperationName>
```

Note `___` (**three** underscores) between `server_label` and the rest, then a **single** `_` between `connectorName` and operation name. Example for Box attached with `server_label="box5"`:

| `mcpserverConfigProperties` op | `tools/list` `name` | `description` |
|---|---|---|
| `ListRootFolder` | `box5___box_ListRootFolder` | `box - List files and folders in root folder` |
| `GetFileMetadata` | `box5___box_GetFileMetadata` | `box - Get file metadata using id` |

The MCP tool's `inputSchema` is exactly the JSON schema derived from `apiOperations/{op}?$expand=properties/inputsDefinition` (the `agentParameters[].schema` values, re-keyed by parameter name). For an operation with no agent parameters, `inputSchema` is `{"type":"object"}`.

Worked `tools/call` for "list my files in Box" — verified end-to-end:

```jsonc
POST {dp}/toolboxes/{tb}/mcp?api-version=v1
{
  "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "box5___box_ListRootFolder", "arguments": {} }
}
→ 200
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "[]" }],
    "isError": false
  }
}
```

(`text` carries a JSON-stringified array of Box file/folder objects; empty `[]` means the root folder is empty.)

### `outlook` connector — verified end-to-end (2026-05-22)

Uses `identityProvider: oauth2generic` (MSA / consumers tenant). `connectorName = "outlook"`, `toolEntityId` objectId = `outlook`. `tools/call` response wraps in `{ "value": [...] }` (not a bare array like Box):

```jsonc
POST {dp}/toolboxes/{tb}/mcp?api-version=v1
{
  "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "outlook-1___outlook_GetEmailsV2",
              "arguments": { "folderPath": "Inbox", "top": 3 } }
}
→ 200
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "content": [{ "type": "text",
      "text": "{\n  \"value\": [\n    { \"Subject\": \"...\", \"From\": \"...\", ... }\n  ]\n}" }],
    "isError": false
  }
}
```

Operations registered for the test: `GetEmailsV2` (read emails with `folderPath` / `top` / `fetchOnlyUnread` agent parameters) and `SendEmailV2` (send with `emailMessage` object param containing required `To`, `Subject`, `Body`). `SendEmailV2`'s top-level schema is `object` — pass it as a single nested `agentParameters` entry; the gateway flattens into the Logic Apps `emailMessage` envelope internally. The follow-up PUT after popup close (pending-true path) immediately returned `overallStatus: Connected` without needing the GET poll loop — outlook's MSA consent round-trips are fast.

## Minimum attach + verify recipe

Verifying a fresh connection is the only toolbox operation in scope of this reference. Toolboxes are upserted implicitly by `POST /versions`; no separate container create is needed.

The `$dp` value below is the project's data-plane endpoint, in the same `{project_endpoint}` form used elsewhere in these references — `https://<account>.services.ai.azure.com/api/projects/<project>`. The host segment varies by Foundry account/region; read it from a non-`FOUNDRY_`-prefixed env var (see [use-toolbox-in-hosted-agent.md § Set TOOLBOX_ENDPOINT](use-toolbox-in-hosted-agent.md#1-set-toolbox_endpoint)) rather than hardcoding. The bearer-token resource is `https://ai.azure.com`, NOT ARM.

```pwsh
# 0. Constants.
$dp   = $env:PROJECT_ENDPOINT   # https://<account>.services.ai.azure.com/api/projects/<project>
$tb   = "default-tb"
$lbl  = "box5"                  # becomes the "<label>___" prefix on tool names
$connId = "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<acct>/projects/<proj>/connections/<connName>"
$tok  = az account get-access-token --resource "https://ai.azure.com" --query accessToken -o tsv
$hdr  = @{ Authorization      = "Bearer $tok"
           "Content-Type"     = "application/json"
           Accept             = "application/json, text/event-stream" }

# 1. Create a toolbox version with the connection attached.
$body = @{ tools = @(@{
   type = "mcp"
   server_label = $lbl
   project_connection_id = $connId
}) } | ConvertTo-Json -Depth 6 -Compress
$v = Invoke-WebRequest -Method POST -Headers $hdr -UseBasicParsing -Body $body `
        -Uri "$dp/toolboxes/$tb/versions?api-version=v1"
$ver = ($v.Content | ConvertFrom-Json).version

# 2. Promote the new version to default. default_version MUST be a JSON STRING, not a number.
#    Use ${tb} to terminate the variable name unambiguously before the literal '?'.
Invoke-WebRequest -Method PATCH -Headers $hdr -UseBasicParsing `
   -Body (@{ default_version = "$ver" } | ConvertTo-Json) `
   -Uri "$dp/toolboxes/${tb}?api-version=v1" | Out-Null

# 3. tools/list → expect one entry per registered op, named "<server_label>___<connectorName>_<OpName>".
$req = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
Invoke-WebRequest -Method POST -Headers $hdr -UseBasicParsing -Body $req `
   -Uri "$dp/toolboxes/$tb/mcp?api-version=v1"

# 4. tools/call → the prefixed name and arguments per inputSchema.
$call = @{ jsonrpc="2.0"; id=2; method="tools/call"; params=@{
   name="$lbl`___box_ListRootFolder"; arguments=@{} } } | ConvertTo-Json -Depth 5 -Compress
Invoke-WebRequest -Method POST -Headers $hdr -UseBasicParsing -Body $call `
   -Uri "$dp/toolboxes/$tb/mcp?api-version=v1"
```

The response body for `/mcp` is plain JSON (no SSE `data:` framing) despite the `text/event-stream` Accept.

