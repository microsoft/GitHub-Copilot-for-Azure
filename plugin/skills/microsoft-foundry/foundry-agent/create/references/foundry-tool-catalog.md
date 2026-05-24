# Foundry Tool Catalog — Project Connections for Remote Tools

Reference for wiring a **remote tool** (catalog tile or generic MCP server) into a Foundry project as a `RemoteTool` project connection, so a toolbox can attach to it.

The public **Tool Catalog API** is the entry point: query it to discover available MCP servers, then use the returned metadata (auth type, server URL, operation list, OAuth URLs/scopes, header shape) to **prepopulate** every required and optional field on the project connection `PUT`. Skip the catalog lookup only for fully BYO generic MCP servers — every catalog-MCP or connector-namespace flow needs it.

> 📘 For the toolbox MCP endpoint, protocol, and testing, see [toolbox-reference.md](toolbox-reference.md).
> 📘 For prompt-agent MCP wiring (without a toolbox), see [tool-mcp.md](tool-mcp.md).

## When to use this reference

Use when the user mentions any of:

- *Build → Tools → Connect a tool* (any subtab — Configured, Catalog, Custom)
- "Tool connection", "Remote MCP", "Catalog tile", "Custom · Preview"
- A specific catalog tile (GitHub, Box, Pipedrive, monday.com, Microsoft Learn, …)
- `RemoteTool` connection, `gateway_connector`, `catalog_MCP`, `generic_mcp`
- **Connector Namespace** / managed MCP server (powered by the Connector Namespace)
- "Bring my own OAuth App" (BYO `client_id` + `client_secret`) for a catalog connector
- Discovering connector operations (`x-ms-operations`) or trigger support (`x-ms-trigger`) via the catalog API

Do **not** use for: non-tool connections (Azure OpenAI, AI Search account, Storage), or general toolbox CRUD beyond the attach-and-verify recipe below.

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

The caller's AAD `oid` / `tid` (needed only for the consent-link step) are auto-discovered via `az ad signed-in-user show --query id -o tsv` and `az account show --query tenantId -o tsv`.

## ARM endpoint (shared by every variant)

```
PUT https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}
    /providers/Microsoft.CognitiveServices/accounts/{acct}
    /projects/{proj}/connections/{name}?api-version=2025-04-01-preview
```

Preflight RBAC — caller needs **Azure AI Developer** or **Cognitive Services Contributor** on the project scope. Empty role list → expect `403 AuthorizationFailed` on PUT.

- `properties.target` is **required** for every `authType`. The exact value depends on the variant — see each body shape below.
- `properties.group` is server-filled (`GenericProtocol` for `RemoteTool`).
- `properties.credentials` is scrubbed to `null` on GET.
- `properties.peRequirement` defaults to `"NotRequired"`.

Allowed `authType` for `category=RemoteTool` (per `api-version=2025-04-01-preview`):
`None, CustomKeys, OAuth2, ProjectManagedIdentity, DeveloperConnection, UserEntraToken, AgentUserImpersonation, AgenticIdentityToken, AgenticUser, UserTokenAndProjectManagedIdentity`. `ApiKey` is **rejected** for `RemoteTool`. The authoritative list is whatever the [Cognitive Services projects API reference](https://learn.microsoft.com/rest/api/aiservices/) returns for the current API version — if you hit `invalid_payload: unsupported authType`, re-check against the schema for the version you're calling.

## Decision tree

| User scenario | `authType` | `metadata.type` | Notes |
|---|---|---|---|
| Catalog tile tagged "Custom · Preview" (Box, Pipedrive, GitHub, Salesforce, …) | `OAuth2` | `gateway_connector` | **Connector-namespace managed MCP.** Powered by the Connector Namespace in your Foundry account; the namespace handles OAuth, token storage, and per-user passthrough. Needs `listConsentLinks` round-trip per caller (see [Gateway connector full flow](#gateway-connector-full-flow)). |
| Catalog MCP tile with Microsoft-managed OAuth (no `client_id` needed) | `OAuth2` | `catalog_MCP` | Foundry brokers the OAuth app for you. The Catalog API tile **prepopulates** `target` (server URL), `authorizationUrl`, `tokenUrl`, and `scopes`. |
| Catalog MCP tile with **your own** OAuth App | `OAuth2` | `catalog_MCP` *(recommended)* or omit | Even when you supply your own `client_id` + `client_secret`, set `metadata.type=catalog_MCP` so the Catalog API can prepopulate `authorizationUrl`, `tokenUrl`, and `scopes` from the tile spec. Omit `metadata.type` only when targeting an MCP server that has no catalog entry. |
| Remote MCP, Azure-side identity (project MI calls the server) | `ProjectManagedIdentity` | `catalog_MCP` *(when the server has a tile)* or `generic_mcp` | For catalog-listed MCP servers, prefer `catalog_MCP` so `target` and any required headers are prepopulated from the Catalog API. Use `generic_mcp` only for ad-hoc / unlisted servers. Requires `audience` in `metadata` so the MI token is issued for the correct resource. |
| Remote MCP, static shared secret / header key | `CustomKeys` | `catalog_MCP` *(when listed)* or `generic_mcp` | Header **name and format** are NOT always `Authorization: Bearer ...`. Read the required header name, value template, and any required additional headers from the Catalog API entry's `x-ms-connection-parameters` and use those exact key names in `credentials.keys`. |
| Remote MCP, user's Entra token forwarded | `UserEntraToken` | `generic_mcp` | Per-user identity passthrough. Not supported when the agent is published to Teams. |
| Custom OpenAPI / A2A tool (no MCP) | varies | n/a | Use the Custom subtab shapes; outside the MCP toolbox path. See [agent-tools.md](agent-tools.md). |

## Catalog API — registries, discovery, and prepopulation

The Catalog API is what the Foundry portal *Build → Tools → Catalog* tab calls behind the scenes. Programmatic callers should use it for exactly the same reasons: to discover what's available, learn the exact auth and operation shape, and **prepopulate** every PUT field.

### The two registries

A Foundry account exposes **two** tool registries through the same Catalog API — they're distinguished by the `entityContainerId` filter:

| Registry | `entityContainerId` | Contents | When to use |
|---|---|---|---|
| **Public catalog** (default) | `connectors-registry-prod-bl` | Microsoft + verified third-party + independent-publisher catalog tiles (GitHub, Box, Salesforce, Microsoft Learn, …). Backed by the global Connector Namespace. | Default for any user-facing tile or managed-MCP scenario. |
| **Private tools catalog** (tenant-scoped) | tenant-specific (returned by the management plane for your account) | Tools your tenant or org has registered privately — internal MCP servers, custom OpenAPI, scoped A2A peers. See the [private tools catalog doc](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog#private-tools-catalog) for registration. | Discovery of internal tools that should not appear in the public catalog. |

Always query both registries when surfacing "available tools" to a user — the private catalog wins on naming collisions because it represents tenant policy.

### Catalog endpoint

```
POST https://eastus.api.azureml.ms/asset-gallery/v1.0/tools
Headers:
  Authorization: Bearer <token for https://ai.azure.com/.default>
  Content-Type: application/json
  x-ms-user-agent: AzureMachineLearningWorkspacePortal/12.0
```

> The asset-gallery endpoint is **always served from `eastus`** regardless of your Foundry project's region. Do not substitute your project region into the host.

Filter body shape (use `freeTextSearch: "*"` to list everything):

```json
{
  "freeTextSearch": "*",
  "filters": [
    { "field": "entityContainerId", "operator": "eq", "values": ["connectors-registry-prod-bl"] },
    { "field": "type",              "operator": "eq", "values": ["tools"] },
    { "field": "kind",              "operator": "eq", "values": ["Versioned"] },
    { "field": "labels",            "operator": "eq", "values": ["latest"] }
  ],
  "pageSize": 100,
  "skip": 0,
  "includeTotalResultCount": true
}
```

To fetch a single connector, add `{ "field": "annotations/name", "operator": "eq", "values": ["<connector-name>"] }`.

### Key fields returned per connector

| Field | What it tells you | Where it goes on the PUT |
|---|---|---|
| `entityId` | Unique catalog entity reference. | `metadata.toolEntityId` |
| `annotations.name` | Stable connector identifier (`github`, `box`, `pipedrive`, …). | `metadata.connectorName` and `metadata.connectionproperties` (`{"connectorName":"..."}`) |
| `properties.title` | Display name for UX. | UI only |
| `properties.x-ms-runtime-urls[0]` | The MCP server URL the toolbox will call. | `properties.target` |
| `properties.x-ms-capabilities` | Capability flags. Includes `"triggers"` when the connector can be a routine event source. | Used for [routines](agent-tools.md#routines-preview) and for filtering |
| `properties.x-ms-operations[]` | Every callable operation. Each has `operationId`, `operationName`, and (for triggers) an `x-ms-trigger` value of `"batch"` (poll) or `"single"` (webhook). | `metadata.operations` (subset list) |
| `properties.x-ms-connection-parameters` | Auth shape. Map of parameter objects with `type` = `oauthSetting` / `securestring` / `string` / …. Determines `authType` and the exact `credentials.keys` names. | Drives `authType`, `credentials`, headers |
| `properties.x-ms-oauth-settings` (when present) | OAuth `authorizationUrl`, `tokenUrl`, and default `scopes` for the catalog tile. | `credentials.authorizationUrl`, `credentials.tokenUrl`, `credentials.scopes` |

Deriving `authType` from `x-ms-connection-parameters`:

- Any parameter with `type: oauthSetting` → `authType = OAuth2`.
- Else any parameter with `type: securestring` → `authType = CustomKeys`.
- Else → `authType = None` (anonymous) or `ProjectManagedIdentity` if the connector explicitly supports MI.

## Body shape — `OAuth2` + `gateway_connector` (Custom · Preview / connector-namespace managed MCP)

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<x-ms-runtime-urls[0] from catalog>",
    "authType": "OAuth2",
    "connectorName": "<annotations.name from catalog>",  // e.g. "github", "box"
    "peRequirement": "NotRequired",
    "metadata": {
      "type": "gateway_connector",
      "connectorName": "<annotations.name from catalog>",
      "toolEntityId": "<entityId from catalog>",
      "connectionproperties": "{\"connectorName\":\"<annotations.name from catalog>\"}",  // JSON string, not object
      "operations": [ /* optional subset of x-ms-operations[].operationId */ ]
    },
    "credentials": {
      "type": "OAuth2",
      "clientId": "<from x-ms-oauth-settings or your BYO app>",
      "authorizationUrl": "<from x-ms-oauth-settings>",
      "tokenUrl": "<from x-ms-oauth-settings>",
      "scopes": "<from x-ms-oauth-settings>"
    }
  }
}
```

Key fields:

- `connectorName` (both top-level under `properties` and inside `metadata` and `connectionproperties`) is **the stable connector identifier from the catalog** (`github`, `box`, …). The Connector Namespace uses it to route requests, store credentials, and — for [routines](agent-tools.md#routines-preview) — register webhooks or poll loops. Always copy it verbatim from `annotations.name`.
- `toolEntityId` lets the platform tie the connection back to a specific catalog version, so portal updates to the tile flow through without redeploying your agent.
- `connectionproperties` is a JSON-encoded **string**, not a nested object — a common 400 cause.

### Gateway connector full flow

1. **Discover** — query the Catalog API and pick the connector (`annotations.name`). Read `entityId`, `x-ms-runtime-urls[0]`, `x-ms-connection-parameters`, and (for OAuth tiles) `x-ms-oauth-settings`.
2. **Provision the OAuth app**:
   - *Microsoft-managed:* leave `credentials.clientId` empty; Foundry uses its multi-tenant app.
   - *BYO:* register an app in the target service (e.g. GitHub OAuth App), add the redirect URI documented on the catalog tile, capture `clientId` and `clientSecret`.
3. **PUT the connection** with `authType=OAuth2`, `metadata.type=gateway_connector`, and the body above. A successful response returns HTTP 200 with `properties.overallStatus = "Unauthenticated"`.
4. **Per-caller consent** — for every distinct end-user, call `listConsentLinks` on the connection:

   ```
   POST .../connections/{name}/listConsentLinks?api-version=2025-04-01-preview
   Body: { "userObjectId": "<caller-oid>", "tenantId": "<caller-tid>" }
   ```

   Open the returned URL in a browser, complete consent. Foundry stores the per-user grant in the Connector Namespace.
5. **Poll status** — GET the connection until `properties.overallStatus = "Connected"`. The portal exposes the same field as "Status: Connected".
6. **Attach the connection to a toolbox** via the `mcp` tool entry (`project_connection_id = <connection name>`) and verify with `tools/list` (see [Minimum attach + verify recipe](#minimum-attach--verify-recipe)).
7. **Handle CONSENT_REQUIRED at runtime** — if a new caller invokes a tool without prior consent, the toolbox MCP `tools/call` returns error code **`-32007`** (`CONSENT_REQUIRED`) with a consent URL. Surface it to the user and retry after they complete it. See [toolbox-reference.md § OAuth Consent Handling](toolbox-reference.md#oauth-consent-handling).

## Body shape — `OAuth2` + `catalog_MCP` (Microsoft-managed OAuth)

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<x-ms-runtime-urls[0] from catalog>",
    "authType": "OAuth2",
    "peRequirement": "NotRequired",
    "metadata": {
      "type": "catalog_MCP",
      "toolEntityId": "<entityId from catalog>"
    },
    "credentials": { "type": "OAuth2" }
  }
}
```

No `clientId` / `clientSecret` is required — Foundry brokers them. The Catalog API supplies the OAuth URLs and scopes through `toolEntityId`. Consent flow is identical to the gateway-connector flow above.

## Body shape — BYO OAuth App against a catalog MCP server

Keep `metadata.type=catalog_MCP` so the catalog can still prepopulate `authorizationUrl`, `tokenUrl`, and `scopes`; supply your own `clientId` + `clientSecret`:

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<x-ms-runtime-urls[0] from catalog>",
    "authType": "OAuth2",
    "peRequirement": "NotRequired",
    "metadata": {
      "type": "catalog_MCP",
      "toolEntityId": "<entityId from catalog>"
    },
    "credentials": {
      "type": "OAuth2",
      "clientId": "<your app's client_id>",
      "clientSecret": "<your app's client_secret>",
      "authorizationUrl": "<from x-ms-oauth-settings; override only if your app uses a different endpoint>",
      "tokenUrl": "<from x-ms-oauth-settings; override only if your app uses a different endpoint>",
      "scopes": "<from x-ms-oauth-settings>"
    }
  }
}
```

Omit `metadata.type` entirely only when the target MCP server has **no catalog tile at all** — in that case you also have to hardcode every OAuth URL yourself, which is brittle.

## Body shape — `ProjectManagedIdentity` (catalog-listed MCP)

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<x-ms-runtime-urls[0] from catalog>",
    "authType": "ProjectManagedIdentity",
    "peRequirement": "NotRequired",
    "metadata": {
      "type": "catalog_MCP",
      "toolEntityId": "<entityId from catalog>",
      "audience": "<resource URI the MCP server validates>"
    }
  }
}
```

`audience` (in `metadata`) is **required** for MI auth — it tells Foundry which resource URI to request a token for. Typical values include the MCP server's app ID URI (e.g. `api://contoso-mcp`) or an Azure service resource ID (e.g. `https://management.azure.com/`). Read the required `audience` from the connector's catalog entry (under `x-ms-connection-parameters` or the tile's documentation). If you omit `audience`, Foundry can't acquire a usable MI token and the MCP server rejects the call with 401.

For an unlisted server, swap `metadata.type` to `generic_mcp` and keep `audience`. The MCP server must accept tokens issued to the project's managed identity (i.e. validate the MI's `oid` / `appid` against an allowlist).

## Body shape — `CustomKeys` (catalog-listed MCP, header shape from catalog)

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<x-ms-runtime-urls[0] from catalog>",
    "authType": "CustomKeys",
    "peRequirement": "NotRequired",
    "metadata": {
      "type": "catalog_MCP",
      "toolEntityId": "<entityId from catalog>"
    },
    "credentials": {
      "type": "CustomKeys",
      "keys": {
        // Header NAME and value FORMAT come from x-ms-connection-parameters.
        // Examples below — do NOT default to "Authorization: Bearer".
        "<HeaderName>": "<value template>",
        "<AnotherHeader>": "<value>"
      }
    }
  }
}
```

The header name and value format are **not always `Authorization: Bearer ...`**. Different connectors require different header names:

- GitHub PAT: `Authorization: Bearer <pat>` or `Authorization: token <pat>` — catalog dictates.
- API-key services: `x-api-key: <key>` or `Ocp-Apim-Subscription-Key: <key>`.
- Multi-header schemes: e.g. `X-Account-Id: <id>` + `X-Account-Secret: <secret>`.

Always read the canonical header set from the connector's `x-ms-connection-parameters` (each parameter object names the header it maps to) before writing the `keys` block. Key names map 1:1 to outbound HTTP headers; values are forwarded as-is to the MCP server.

For unlisted servers, use `metadata.type=generic_mcp` and hand-author the header set.

## Body shape — `UserEntraToken` + `generic_mcp`

```jsonc
{
  "properties": {
    "category": "RemoteTool",
    "target": "<server_url>",
    "authType": "UserEntraToken",
    "peRequirement": "NotRequired",
    "metadata": { "type": "generic_mcp" }
  }
}
```

Forwards the calling user's Entra token to the MCP server. Not available when the agent is published to Teams (Teams agents use the project MI).

## Minimum attach + verify recipe

Verifying a fresh connection is the only toolbox operation in scope of this reference. Toolboxes are upserted implicitly by `POST /versions`; no separate container create is needed.

The `$dp` value below is the project's data-plane endpoint, in the same `{project_endpoint}` form used elsewhere in these references — `https://<account>.services.ai.azure.com/api/projects/<project>`. The host segment varies by Foundry account/region; read it from a non-`FOUNDRY_`-prefixed env var (see [toolbox-reference.md § Agent env contract](toolbox-reference.md#agent-env-contract)) rather than hardcoding.

```pwsh
# Required dataplane header on every request below.
$dp  = $env:PROJECT_ENDPOINT   # e.g. https://<account>.services.ai.azure.com/api/projects/<project>
$tb  = "<toolbox-name>"        # defaults to default-tb
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
# Use ${tb} to terminate the variable name unambiguously before the literal '?'.
Invoke-RestMethod -Method PATCH -Headers $hdr `
   -Body (@{default_version="<n>"} | ConvertTo-Json) `
   -Uri "$dp/toolboxes/${tb}?api-version=v1" | Out-Null

# 3. tools/list — should return tools prefixed with $lbl (MCP-sourced only).
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
- **`properties.target`** is required. For `catalog_MCP` / `gateway_connector` it must be the catalog's `x-ms-runtime-urls[0]`. The literal `"https://placeholder"` is **only** accepted on some older `gateway_connector` deployments — always prefer the real URL.
- **`connectionproperties` must be a JSON-encoded string**, not a nested object. `"{\"connectorName\":\"github\"}"` is correct; `{"connectorName":"github"}` is rejected.
- **`metadata.audience` is required for `ProjectManagedIdentity`.** Without it, Foundry can't pick the right token audience and the server returns 401.
- **Header names for `CustomKeys` come from the catalog**, not from a default `Authorization: Bearer` template. Read `x-ms-connection-parameters` first.
- **`ApiKey` is rejected** for `category=RemoteTool`. Use `CustomKeys` for static secrets.
- **OAuth consent is per-user, per-connection, per-project.** Each new caller hits `CONSENT_REQUIRED` (code `-32007`) once and must open the URL the toolbox returns.
- **Network-secured Foundry** projects cannot use private-endpoint-only MCP servers — only public endpoints reachable from the Foundry data plane and the Connector Namespace.

## References

- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Toolbox (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [Private tools catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog#private-tools-catalog)
- [Cognitive Services projects REST API](https://learn.microsoft.com/rest/api/aiservices/)
- [tool-mcp.md](tool-mcp.md) — prompt-agent MCP wiring (no toolbox)
- [toolbox-reference.md](toolbox-reference.md) — MCP endpoint, auth, testing, troubleshooting
- [agent-tools.md](agent-tools.md) — the agent-tools index, including [Routines](agent-tools.md#routines-preview) (which reuse the same Connector Namespace as `gateway_connector` for event-based triggers)
- [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md) — wiring a toolbox into a hosted agent
