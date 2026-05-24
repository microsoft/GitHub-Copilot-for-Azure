# Foundry Tool Catalog — Project Connections for Remote Tools

Reference for wiring a **remote tool** (catalog tile or generic MCP server) into a Foundry project as a `RemoteTool` project connection, so a toolbox can attach to it. Covers the connection shapes the portal *Build → Tools → Connect a tool* wizard produces and the minimum attach-and-verify recipe.

> 📘 For the toolbox MCP endpoint, protocol, and testing, see [toolbox-reference.md](toolbox-reference.md).
> 📘 For prompt-agent MCP wiring (without a toolbox), see [tool-mcp.md](tool-mcp.md).

## When to use this reference

Use when the user mentions any of:

- *Build → Tools → Connect a tool* (any subtab — Configured, Catalog, Custom)
- "Tool connection", "Remote MCP", "Catalog tile", "Custom · Preview"
- A specific catalog tile (GitHub, Box, Pipedrive, monday.com, Microsoft Learn, …)
- `RemoteTool` connection, `gateway_connector`, `catalog_MCP`, `generic_mcp`
- "Bring my own OAuth App" (BYO `client_id` + `client_secret`) for a catalog connector

Do **not** use for: provisioning Logic Apps, non-tool connections (Azure OpenAI, AI Search account, Storage), or general toolbox CRUD beyond the attach-and-verify recipe below.

## Inputs to gather upfront

Before generating any PUT body, ask the user in one batched question for:

1. **Subscription id**
2. **Resource group**
3. **Cognitive Services account name** (the Foundry account)
4. **Project name** (under the account)
5. **Connection name** — lowercase, `[a-z0-9-]`, ≤ 24 chars (e.g. `box-1`, `gh-byo`)
6. **Tool scenario in plain language** — e.g. "list my files in Box", "create issues on GitHub"
7. **Toolbox name** to attach into for verification (defaults to `default-tb`)
8. **Secrets** (BYO `clientId` / `clientSecret`, `CustomKeys` header value, …) — ask the user to **type these directly into the terminal**, never via tooling that echoes them

The caller's AAD `oid` / `tid` (needed only for the `gateway_connector` consent step) are auto-discovered via `az ad signed-in-user show --query id -o tsv` and `az account show --query tenantId -o tsv`.

## ARM endpoint (shared by every variant)

```
PUT https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}
    /providers/Microsoft.CognitiveServices/accounts/{acct}
    /projects/{proj}/connections/{name}?api-version=2025-04-01-preview
```

Preflight RBAC — caller needs **Azure AI Developer** or **Cognitive Services Contributor** on the project scope. Empty role list → expect `403 AuthorizationFailed` on PUT.

- `properties.target` is **required** for every `authType`. For the `gateway_connector` flow specifically, the literal string `"https://placeholder"` is the correct, permanent value.
- `properties.group` is server-filled (`GenericProtocol` for `RemoteTool`).
- `properties.credentials` is scrubbed to `null` on GET.
- `properties.peRequirement` defaults to `"NotRequired"`.

Allowed `authType` for `category=RemoteTool` (2026-05 snapshot):
`None, CustomKeys, OAuth2, ProjectManagedIdentity, DeveloperConnection, UserEntraToken, AgentUserImpersonation, AgenticIdentityToken, AgenticUser, UserTokenAndProjectManagedIdentity`. `ApiKey` is **rejected** for `RemoteTool`.

## Decision tree

| User scenario | `authType` | `metadata.type` | Notes |
|---|---|---|---|
| Catalog tile tagged "Custom · Preview" (Box, Pipedrive, …) | `OAuth2` | `gateway_connector` | Backed by a Logic Apps managed connector. Needs `listConsentLinks` round-trip per caller. |
| Catalog MCP tile with Microsoft-managed OAuth (no `client_id` needed) | `OAuth2` | `catalog_MCP` | Foundry brokers the OAuth app for you. |
| Catalog MCP tile with **your own** OAuth App | `OAuth2` | (omit) | BYO `client_id` + `client_secret`. Same `RemoteTool` category. |
| Remote MCP, Azure-side identity (project MI calls the server) | `ProjectManagedIdentity` | `generic_mcp` | No user secrets. Server must accept the project MI's token. |
| Remote MCP, static shared secret / header key | `CustomKeys` | `generic_mcp` | Keys map → headers (e.g. `Authorization: Bearer {{ pat }}`). |
| Remote MCP, user's Entra token forwarded | `UserEntraToken` | `generic_mcp` | Per-user identity passthrough. Not supported when the agent is published to Teams. |
| Custom OpenAPI / A2A tool (no MCP) | varies | n/a | Use the Custom subtab shapes; outside the MCP toolbox path. |

## Catalog API lookup (do this first for any catalog tile)

To wire a connection to a catalog connector you almost always need both of these read-only endpoints; they fill different fields on the PUT body.

1. **Asset-gallery** (Foundry's index of catalog tiles) — returns the tile's display name, icon, supported `authType` set, and the underlying `connectorId` (for `gateway_connector`) or `server_url` (for `catalog_MCP`).
2. **Logic Apps managedApis + apiOperations** (only for `gateway_connector`) — returns the operation list and the OAuth `authorizationUrl` / `tokenUrl` / `scopes` you must echo into `properties.credentials`.

Missing either lookup is the most common cause of "the portal works but my PUT 400s" — the OAuth fields the portal silently fills are required by the validator.

## Body shape — `OAuth2` + `gateway_connector` (Custom · Preview tile)

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "https://placeholder",
    "authType": "OAuth2",
    "metadata": {
      "type": "gateway_connector",
      "connectorId": "<from asset-gallery>",
      "operations": [ /* subset of apiOperations */ ]
    },
    "credentials": {
      "type": "OAuth2",
      "clientId": "<from managedApi>",
      "authorizationUrl": "<from managedApi>",
      "tokenUrl": "<from managedApi>",
      "scopes": "<from managedApi>"
    }
  }
}
```

After PUT, call `listConsentLinks` with the caller's `oid` + `tid` and open the returned URL once per user. Subsequent `tools/call` invocations through the toolbox will succeed; otherwise the toolbox MCP `tools/call` returns `CONSENT_REQUIRED` (`-32006`) — see [toolbox-reference.md](toolbox-reference.md#oauth-consent-handling).

## Body shape — `OAuth2` + `catalog_MCP` (Microsoft-managed OAuth)

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<server_url from asset-gallery>",
    "authType": "OAuth2",
    "metadata": { "type": "catalog_MCP" },
    "credentials": { "type": "OAuth2" }
  }
}
```

No `clientId` / `clientSecret` is required — Foundry brokers them. Consent flow is the same as `gateway_connector`.

## Body shape — BYO OAuth App against a catalog MCP server

Omit `metadata.type`; provide your own `clientId` + `clientSecret`:

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<server_url>",
    "authType": "OAuth2",
    "credentials": {
      "type": "OAuth2",
      "clientId": "<your app's client_id>",
      "clientSecret": "<your app's client_secret>",
      "authorizationUrl": "<server's authorize URL>",
      "tokenUrl": "<server's token URL>",
      "scopes": "<space-separated scopes>"
    }
  }
}
```

## Body shape — `ProjectManagedIdentity` + `generic_mcp`

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<server_url>",
    "authType": "ProjectManagedIdentity",
    "metadata": { "type": "generic_mcp" }
  }
}
```

The MCP server must accept tokens issued to the project's managed identity. No user-side consent.

## Body shape — `CustomKeys` + `generic_mcp`

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<server_url>",
    "authType": "CustomKeys",
    "metadata": { "type": "generic_mcp" },
    "credentials": {
      "type": "CustomKeys",
      "keys": {
        "Authorization": "Bearer <static_pat_or_secret>"
      }
    }
  }
}
```

Key names map 1:1 to outbound HTTP headers Foundry sends to the MCP server.

## Body shape — `UserEntraToken` + `generic_mcp`

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<server_url>",
    "authType": "UserEntraToken",
    "metadata": { "type": "generic_mcp" }
  }
}
```

Forwards the calling user's Entra token to the MCP server. Not available when the agent is published to Teams (Teams agents use the project MI).

## Minimum attach + verify recipe

Verifying a fresh connection is the only toolbox operation in scope of this reference. Toolboxes are upserted implicitly by `POST /versions`; no separate container create is needed.

```pwsh
# Required dataplane header on every request below.
$dp  = "https://<account>.services.ai.azure.com/api/projects/<proj>"
$tb  = "<toolbox-name>"            # defaults to default-tb
$conn= "<connection-name>"
$lbl = "<server_label>"
$tok = az account get-access-token --resource "https://ai.azure.com" --query accessToken -o tsv
$hdr = @{
  Authorization      = "Bearer $tok"
  "Content-Type"     = "application/json"
  "Foundry-Features" = "Toolboxes=V1Preview"   # REQUIRED
}

# 1. Create a toolbox version with the connection attached.
$body = @{
  description = "verify $conn"
  tools = @(@{
    type                  = "mcp"
    server_label          = $lbl
    server_url            = "<server_url>"   # ignored for catalog_MCP; required for generic_mcp
    require_approval      = "never"
    project_connection_id = $conn
  })
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method POST -Headers $hdr `
   -Uri "$dp/toolboxes/$tb/versions?api-version=v1" -Body $body | Out-Null

# 2. Promote that version to default (optional — newest is default if unset).
# Note: default_version must be a JSON STRING, not a number.
Invoke-RestMethod -Method PATCH -Headers $hdr `
   -Body (@{default_version="<n>"} | ConvertTo-Json) `
   -Uri "$dp/toolboxes/$tb`?api-version=v1" | Out-Null

# 3. tools/list — should return tools prefixed with $lbl.
Invoke-RestMethod -Method POST -Headers $hdr `
   -Body (@{jsonrpc='2.0';id=1;method='tools/list';params=@{}} | ConvertTo-Json) `
   -Uri "$dp/toolboxes/$tb/mcp?api-version=v1"

# 4. tools/call — one round-trip to prove the connection works end-to-end.
Invoke-RestMethod -Method POST -Headers $hdr `
   -Body (@{jsonrpc='2.0';id=2;method='tools/call';params=@{name="$lbl.<tool>";arguments=@{}}} | ConvertTo-Json) `
   -Uri "$dp/toolboxes/$tb/mcp?api-version=v1"
```

The `Foundry-Features: Toolboxes=V1Preview` header is mandatory — without it the toolbox endpoint returns HTTP 400.

## Common gotchas

- **Toolbox PATCH `default_version` must be a JSON STRING**, not a number. `"3"` works; `3` fails validation.
- **Connection name** is immutable and lowercased server-side. Pick once; renames require delete + recreate.
- **`properties.target`** is required even for `gateway_connector`. Use the literal `https://placeholder`.
- **`ApiKey` is rejected** for `category=RemoteTool`. Use `CustomKeys` for static secrets.
- **OAuth consent is per-user, per-connection, per-project.** Each new caller hits `CONSENT_REQUIRED` once and must open the URL the toolbox returns.
- **Network-secured Foundry** projects cannot use private-endpoint-only MCP servers — only public endpoints reachable from the Foundry data plane.

## References

- [Tool Catalog](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/tool-catalog?view=foundry)
- [Toolbox (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [tool-mcp.md](tool-mcp.md) — prompt-agent MCP wiring (no toolbox)
- [toolbox-reference.md](toolbox-reference.md) — MCP endpoint, auth, testing, troubleshooting
- [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md) — wiring a toolbox into a hosted agent
