# Selected guidance: When to use this reference; Inputs to gather upfront; ARM endpoint (shared by every variant); Preflight RBAC; Common request template; Body

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

# Foundry Tool Catalog — Project Connections for Remote Tools

Reference for wiring a **remote tool** (catalog tile or generic MCP server) into a Foundry project as a `RemoteTool` project connection, so a toolbox can attach to it.

> 🚦 **Toolbox creation gate:** before creating a toolbox/connection, you MUST read the boundary rules in [create-hosted.md → Toolbox creation boundary](../create-hosted--step-4b-existing-agent-continue-development-step-5-writ.md#toolbox-creation-boundary) and follow them, then continue with the rest of this file.

Catalog discovery is optional and operation-gated. The supplied catalog-fetch
contract has **unverified external usability**; that uncertainty does not prove
it is internal-only or absent from public sources. Do not call a hard-coded
backend, infer support from a tile name or substitute another product's API.
Use an actual discovered supported catalog capability after checking its
operation/schema, source coverage, access and applicable read approval, or use
developer-provided reviewed inputs. If neither exists, state the missing
metadata precisely and retain independently documented BYO MCP/OpenAPI tasks
whose reviewed inputs and approvals suffice.

> 📘 For the toolbox MCP endpoint, protocol, and testing, see [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md).
> 📘 For prompt-agent MCP wiring (without a toolbox), see [tool-mcp.md](tools/prompt-agent/tool-mcp.md).

## When to use this reference

Use when the user mentions any of:

- *Build → Tools → Connect a tool* (any subtab — Configured, Catalog, Custom)
- "Tool connection", "Remote MCP", "Catalog tile", "Custom · Preview"
- A specific catalog tile (GitHub, Box, Pipedrive, monday.com, Microsoft Learn, …)
- `RemoteTool` connection, `gateway_connector`, `catalog_MCP`, `generic_mcp`
- **Connector Namespace** / managed MCP server (powered by the Connector Namespace)
- "Bring my own OAuth App" (BYO `client_id` + `client_secret`) for a catalog connector
- Discovering connector operations (`x-ms-operations` / Logic Apps `apiOperations`) or trigger support (`x-ms-trigger`) via the catalog APIs

Do **not** use for: non-tool connections (Azure OpenAI, AI Search account, Storage), or general toolbox CRUD beyond the attach-and-verify recipe below.

## Inputs to gather upfront

Before generating any PUT body, ask the user in one batched question for:

1. **Subscription id**
2. **Resource group**
3. **Cognitive Services account name** (the Foundry account)
4. **Project name** (under the account)
5. **Connection name** — lowercase, `[a-z0-9-]`, ≤ 24 chars (e.g. `box-1`, `gh-byo`)
6. **Tool scenario in plain language** — e.g. "list my files in Box", "create issues on GitHub". Map this onto operations from the connector's `apiOperations` catalog for `gateway_connector`, or onto the catalog MCP server's `tools/list` for `catalog_MCP` / BYO.
7. **Toolbox name** to attach into for verification (defaults to `default-tb`)
8. **Secrets** (BYO `clientId` / `clientSecret`, `CustomKeys` header value, …) — ask the user to **type these directly into the terminal**, never via tooling that echoes them

The caller's AAD `oid` / `tid` (needed only for the consent-link step) are auto-discovered via `az ad signed-in-user show --query id -o tsv` and `az account show --query tenantId -o tsv`. For a service-principal caller, use `az ad sp show --id <appId>` instead. These values can also be read from the `oid` / `tid` claims on the ARM bearer token; the gateway validates the caller principal owns them.

## ARM endpoint (shared by every variant)

```
PUT https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}
    /providers/Microsoft.CognitiveServices/accounts/{acct}
    /projects/{proj}/connections/{name}?api-version=2025-04-01-preview
```

### Preflight RBAC

Caller needs **Foundry Project Manager** or **Cognitive Services Contributor** on the project scope. Run this before the first PUT to surface 403s early:

```pwsh
$oid = az ad signed-in-user show --query id -o tsv
$projId = "/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.CognitiveServices/accounts/$acct/projects/$proj"
az role assignment list --assignee $oid --scope $projId --include-inherited --all `
  --query "[?roleDefinitionName=='Foundry Project Manager' || roleDefinitionName=='Cognitive Services Contributor'].roleDefinitionName" -o tsv
```

Empty output → caller lacks the required role; expect `403 AuthorizationFailed` on PUT until granted.

### Common request template

```pwsh
$tok = az account get-access-token --resource "https://management.azure.com" --query accessToken -o tsv
$h   = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }
$uri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.CognitiveServices/accounts/$acct/projects/$proj/connections/${connName}?api-version=2025-04-01-preview"
Invoke-WebRequest -Method PUT -Headers $h -UseBasicParsing -Body $body -Uri $uri
```

### Body invariants

- `properties.target` is **required** for every `authType` (validation rejects empty). The exact value depends on the variant — see each body shape. For `gateway_connector` specifically, the literal string `"https://placeholder"` is the correct value on PUT #1 and is **rewritten by the platform on PUT #2** to the real gateway URL.
- `properties.group` is server-filled (`GenericProtocol` for `RemoteTool`).
- `properties.credentials` is scrubbed to `null` on GET.
- `properties.peRequirement` defaults to `"NotRequired"`.

Allowed `authType` for `category=RemoteTool` (per `api-version=2025-04-01-preview`):
`None, CustomKeys, OAuth2, ProjectManagedIdentity, DeveloperConnection, UserEntraToken, AgentUserImpersonation, AgenticIdentityToken, AgenticUser, UserTokenAndProjectManagedIdentity`. `ApiKey` is **rejected** for `RemoteTool`. The authoritative list is whatever the [Cognitive Services projects API reference](https://learn.microsoft.com/rest/api/aiservices/) returns for the current API version — if you hit `invalid_payload: unsupported authType`, re-check against the schema for the version you're calling.

## Decision tree

| User scenario | `authType` | `metadata.type` | Notes |
|---|---|---|---|
| Catalog tile tagged "Custom · Preview" (Box, Pipedrive, GitHub, Salesforce, Outlook, …) | `OAuth2` | `gateway_connector` | **Connector-namespace managed MCP.** Powered by the Connector Namespace in your Foundry account; the namespace handles OAuth, token storage, and per-user passthrough. Needs **two** PUTs plus `listConsentLinks` per caller (see [Gateway connector full flow](foundry-tool-catalog--gateway-connector-full-flow-step-1-discover-step-2-put-.md#gateway-connector-full-flow)). |
| Catalog MCP tile with Microsoft-managed OAuth (no `client_id` needed) | `OAuth2` | `catalog_MCP` | Foundry brokers the OAuth app for you. The Catalog API tile **prepopulates** `target` (server URL); `listConsentLinks` flow same as gateway. |
| Catalog MCP tile with **your own** OAuth App | `OAuth2` | (omit) | Supply your own `client_id` + `client_secret` + raw `authorizationUrl` / `tokenUrl` / `scopes`. Do **not** mix BYO `credentials` with `metadata.type=catalog_MCP`. See [BYO OAuth caveats](foundry-tool-catalog--body-shape-oauth2-catalog-mcp-microsoft-managed-oauth-b.md#byo-oauth-app-against-a-catalog-mcp-server). |
| Remote MCP, Azure-side identity (project MI calls the server) | `ProjectManagedIdentity` | `catalog_MCP` *(when listed)* or `generic_mcp` | For catalog-listed MCP servers, prefer `catalog_MCP` so `target` is prepopulated. Requires `audience` in `metadata`. See [PMI limitations](foundry-tool-catalog--body-shape-oauth2-catalog-mcp-microsoft-managed-oauth-b.md#projectmanagedidentity-limitations). |
| Remote MCP, static shared secret / header key | `CustomKeys` | `catalog_MCP` *(when listed)* or `generic_mcp` | Header **name and format** are NOT always `Authorization: Bearer ...`. Read the required header name from the Catalog API entry's `x-ms-connection-parameters` and use that exact name in `credentials.keys`. |
| Remote MCP, user's Entra token forwarded | `UserEntraToken` | `generic_mcp` | Per-user identity passthrough. Not supported when the agent is published to Teams. Pair with `metadata.audience` for the upstream resource URI. |
| Custom OpenAPI / A2A tool (no MCP) | varies | n/a | Use the Custom subtab shapes; outside the MCP toolbox path. See [Custom subtab — OpenAPI / A2A](foundry-tool-catalog--custom-subtab-openapi-a2a-toolbox-attach-gateway-connec.md#custom-subtab--openapi--a2a). |

