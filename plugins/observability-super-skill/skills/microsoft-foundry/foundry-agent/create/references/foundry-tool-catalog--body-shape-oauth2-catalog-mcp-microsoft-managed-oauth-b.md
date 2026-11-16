# Selected guidance: Body shape — `OAuth2` + `catalog_MCP` (Microsoft-managed OAuth); BYO OAuth App against a catalog MCP server; Filling the OAuth fields from t

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

## Body shape — `OAuth2` + `catalog_MCP` (Microsoft-managed OAuth)

Use when the catalog entry is an MCP server and you accept Microsoft's managed OAuth App + consent flow (no BYO secret):

```json
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "https://api.githubcopilot.com/mcp",
    "credentials": {},
    "metadata": {
      "type": "catalog_MCP",
      "toolEntityId": "azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/github/version/1"
    },
    "peRequirement": "NotRequired"
  }
}
```

If the MCP URL is missing, request the reviewed documented server URL or a
specific approved supported lookup. Do not enumerate another registry as a
fallback. Consent uses the separately gated `listConsentLinks` flow.

## BYO OAuth App against a catalog MCP server

When the user has their own OAuth App (e.g. GitHub `https://github.com/organizations/<org>/settings/applications/<app-id>`) and wants the connection to mint tokens via *their* app instead of Microsoft's managed one. Verified shape, 2026-05-21:

```json
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "<MCP server URL>",
    "credentials": { "clientId": "<your client id>", "clientSecret": "<your client secret>" },
    "authorizationUrl": "https://github.com/login/oauth/authorize",
    "tokenUrl":         "https://github.com/login/oauth/access_token",
    "scopes":           ["repo","workflow","read:org","admin:org"],
    "peRequirement":    "NotRequired"
  }
}
```

### Filling the OAuth fields from the catalog APIs

1. **Obtain the reviewed connector identifier** from developer-provided inputs
   or an actual discovered supported catalog capability with approved bounded
   reads. Do not infer an identifier from the connector name.
2. **Look up OAuth metadata** — `GET .../managedApis/<objectId>?api-version=2016-06-01`. From `properties.connectionParameters.token.oAuthSettings`:
   - `identityProvider` → look up `authorizationUrl` / `tokenUrl` in the mapping table in [Catalog APIs §2](foundry-tool-catalog--reviewed-local-inputs-catalog-metadata-examples-operati.md#2-logic-apps-managedapis--oauth-source-of-truth).
   - `scopes` → use as the default scopes array (override only if the user explicitly needs different scopes).
3. **Supply your own `clientId` / `clientSecret`** in `credentials`. Do not reuse the catalog `clientId` from step 2 — that's Microsoft's managed OAuth App and you cannot mint with it.
4. **PUT** the body above.

### Hard rules verified by probe (2026-05-21)

- **`scopes` MUST be a JSON array.** A space-separated string returns `400 "Error when parsing request; unable to deserialize request body"`.
- **DO NOT send `useCustomConnector`.** It is ignored on input; server fills `false`.
- **DO NOT send `metadata.{type=catalog_MCP, toolEntityId, ...}`** for BYO. Those fields anchor the connection to the catalog's managed OAuth App and conflict with your supplied `credentials`.
- **DO NOT call `listConsentLinks`** for BYO — the gateway handles consent via the standard authorization_code flow using the server-filled `redirectUrl`. Calling `listConsentLinks` against a fresh BYO connection returns `404 AIGatewayConnectionNotFound`.

### Server-filled response fields

- `credentials` → `null` (scrubbed).
- `connectorName` → `<gatewayId>-<connectionName>` (your input ignored).
- `redirectUrl` → `https://global.consent.azure-apim.net/redirect/<32-hex>` — **the OAuth callback URL the provider (e.g. GitHub OAuth App) must allow-list**. Generated per-connection on first PUT. Two-pass flow:
  1. PUT with placeholder client_secret.
  2. Read `properties.redirectUrl` from the response.
  3. Register it as the "Authorization callback URL" on the OAuth App.
  4. PUT again with the real client_secret.

### Caveat: `api.githubcopilot.com/mcp` rejects BYO OAuth-App tokens

The GitHub Copilot MCP server requires GitHub-App-minted Copilot tokens (the `microsoft-foundry-agent-service` GitHub App). A token from a user OAuth App will be rejected at runtime even if the connection PUT is 200. For real BYO testing point `target` at a self-hosted GitHub MCP server, or use an OpenAPI tool against `api.github.com` instead.

## `ProjectManagedIdentity` Remote MCP

For MCP servers that accept Azure-side identity (the project's system MI calls the MCP server's bearer endpoint):

```json
{
  "properties": {
    "authType": "ProjectManagedIdentity",
    "category": "RemoteTool",
    "target": "<MCP server URL with required query string>",
    "metadata": { "type": "generic_mcp", "audience": "<upstream resource URI>" }
  }
}
```

For catalog-listed MCP servers, prefer `metadata.type = catalog_MCP` with `toolEntityId` so `target` is prepopulated. `audience` is **required for MI auth** — it tells Foundry which resource URI to request a token for. Read the required `audience` from the connector's catalog entry or its documentation (typical values: an app ID URI like `api://contoso-mcp`, or an Azure service resource ID like `https://cognitiveservices.azure.com`). If you omit `audience`, the MCP server rejects the call with 401.

### `ProjectManagedIdentity` limitations

Verified end-to-end against Azure Language `/language/mcp`, 2026-05-21:

1. **Forwarder drops the query string.** The connection `target`'s `?api-version=...` is **not** preserved on the upstream call. If the upstream MCP requires a query parameter, PMI fails with 401/404 even when RBAC is correct.
2. **Forwarder mints the wrong audience.** The MI token Foundry sends does not have `aud=https://cognitiveservices.azure.com` or `https://ai.azure.com`. Setting `properties.audience` on the connection is accepted but **does not** change what is minted.
3. Endpoints not on the trust list reject the forwarded MI token with `-32007 PERMISSION_DENIED "Cannot pass Microsoft token to untrusted MCP endpoint"` (e.g. `api.githubcopilot.com/mcp`). This is the expected security gate.

## `CustomKeys` Remote MCP

Static header(s) injected on every upstream call. Minimum body:

```json
{
  "properties": {
    "authType": "CustomKeys",
    "category": "RemoteTool",
    "target": "<MCP server URL>",
    "credentials": { "keys": { "Ocp-Apim-Subscription-Key": "<value>" } },
    "metadata": { "type": "generic_mcp" }
  }
}
```

Verified PUT 200 / GET 200 / DELETE 200 round-trip. The header name is **arbitrary** — it is forwarded as-is to the MCP server. Different connectors require different header shapes:

- GitHub PAT: `Authorization: Bearer <pat>` or `Authorization: token <pat>` — catalog dictates.
- API-key services: `x-api-key: <key>` or `Ocp-Apim-Subscription-Key: <key>`.
- Multi-header schemes: e.g. `X-Account-Id: <id>` + `X-Account-Secret: <secret>`.

Always read the canonical header set from the connector's `connectionParameters` (each `securestring` parameter names the header it maps to) before writing the `keys` block. **Do not default to `Authorization: Bearer`** — it's wrong for many connectors.

For catalog-listed servers, swap `metadata.type` to `catalog_MCP` and add `toolEntityId`.

## `UserEntraToken` Remote MCP

For MCP servers that consume the *caller's* Entra token directly. Body includes `metadata.audience` so the platform mints the correct token for the upstream:

```json
{
  "properties": {
    "authType": "UserEntraToken",
    "category": "RemoteTool",
    "target": "<MCP server URL>",
    "metadata": { "type": "generic_mcp", "audience": "<upstream resource URI>" }
  }
}
```

Not available when the agent is published to Teams (Teams agents use the project MI).

