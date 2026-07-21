# Tool — Remote MCP server, OAuth (Foundry-managed connector) (`type: mcp`)

Attach a remote MCP server whose OAuth is **brokered by Foundry** — you do **not** supply `client_id` / `client_secret`. Use this when the MCP server appears as a **catalog tile** ("Custom · Preview" / a connector-namespace connector) and you accept Microsoft's managed OAuth app. Foundry owns the app registration, token storage, and refresh; the first `tools/list` triggers a one-time per-user consent.

For the variant where you own the OAuth app (BYO `client_id` / `client_secret`), see [tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md). For the connector-namespace `gateway_connector` variant (two PUTs + `listConsentLinks`), see [foundry-tool-catalog.md → Gateway connector full flow](../../create/references/foundry-tool-catalog.md#gateway-connector-full-flow).

> 🚦 Before creating a toolbox/connection either way, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

**Flow at a glance:**

1. **List the managed-OAuth connectors** — run the discovery script with `--managed-only` to get the connectors Foundry can broker OAuth for — [Getting the catalog inputs](#getting-the-catalog-inputs).
2. **Check the user's connector is in that list.** If it is, take its `connectorName` / `toolEntityId` / `serverUrl` from the row. If it is **not** listed, this reference does not apply — the connector is BYO-OAuth ([tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md)), key-auth ([tool-mcp-key-auth.md](tool-mcp-key-auth.md)), or no-auth ([tool-mcp-noauth.md](tool-mcp-noauth.md)); stop and switch references.
3. **Create the connection + toolbox** — no client id/secret; Foundry brokers the app — [A. Imperative CLI](#a-imperative-cli) (or [B. Declarative](#b-declarative-azureyaml)).
4. **Verify** — the first `tools/list` returns a one-time consent URL (`-32006`); open it, sign in, retry — [Verify & the consent flow](#verify--the-consent-flow).

There is **no redirect-URI round-trip** (that's a BYO-only step) and **no `client_secret`** to manage — the two things the managed flow removes versus [tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md).

---

# Getting the catalog inputs

**Step 1 — list the connectors Foundry can broker OAuth for**, then **check the user's connector is in that list**. Run the discovery script with `--managed-only`; each row is a connector you can use with this reference:

```bash
../scripts/get-catalog-inputs.sh github --managed-only     # bash
pwsh ../scripts/get-catalog-inputs.ps1 github -ManagedOnly  # PowerShell
```

Drop `--managed-only` / `-ManagedOnly` to see every match with a `managedOAuth: true|false` column (useful to confirm *why* a connector the user wanted is excluded). Each managed row also reports `identityProvider` and default `scopes`.

- **User's connector is listed** → take its `connectorName`, `toolEntityId`, and `serverUrl` from the row and continue to [A. Imperative CLI](#a-imperative-cli).
- **Not listed** → this reference does not apply. It's BYO-OAuth ([tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md)), key-auth ([tool-mcp-key-auth.md](tool-mcp-key-auth.md)), or no-auth ([tool-mcp-noauth.md](tool-mcp-noauth.md)) — switch references.

The two connection inputs the row gives you: the **MCP server URL** (→ `--target`) and the **`toolEntityId`** (→ `--metadata`) — the same values the portal uses (`MCPToolConfigDialog.tsx`: `target ?? tool.remotes?.[0]?.url`; `metadata.toolEntityId = tool.id`).

### How managed OAuth is detected (mirrors the portal)

A tile qualifies for **this** reference only if the connector exposes an OAuth app Foundry can broker. The portal decides this from `x-ms-connector-name` + the connector's security schemes, computed in `transformTools.tsx` (`deriveConnectorSecuritySchemes(connectionParameters)`) and gated in `toolConnectionConfig.ts` (`oAuthProvider = 'managed'` when `isCatalogTool && host === 'remotes' && connectorName`).

The catch: the flat `asset-gallery/v1.0/tools` **search index is thin** — its `properties` carry only `updatedTime`/`creationContext`, **no** `x-ms-connector-name`, `x-ms-auth-schemas`, `remotes[]`, or `connectionParameters`. The portal reads those from a **different** endpoint (the cross-region index-entities API with a `selectFields` projection). The scripts take the simpler equivalent source the portal's `deriveConnectorSecuritySchemes` ultimately reflects — the **Logic Apps `managedApis` GET**:

```
GET .../providers/Microsoft.Web/locations/eastus/managedApis/{connectorName}?api-version=2016-06-01
```

A connector is **managed OAuth** when its `properties.connectionParameters` has an entry of `type: "oauthSetting"`. That entry's `oAuthSettings` also yields `identityProvider` and the default `scopes`. Connectors with only `securestring` params (e.g. `azureblob`) or empty params (e.g. `githubdata`) are **not** managed OAuth. See [foundry-tool-catalog.md → Catalog APIs §2](../../create/references/foundry-tool-catalog.md#2-logic-apps-managedapis--oauth-source-of-truth).

> ⚠️ **`serverUrl` is often empty.** The asset-gallery search index is thin — `remotes[].url` is `null` for many tiles. When empty, supply the connector's **documented** MCP endpoint as `--target` (e.g. github Copilot → `https://api.githubcopilot.com/mcp`). The scripts still recover `toolEntityId` + `connectorName` reliably, which are the values you cannot guess.

Or do it by hand:

1. **Find the connector `entityId`** via the asset-gallery POST — see [foundry-tool-catalog.md → Catalog APIs §1](../../create/references/foundry-tool-catalog.md#1-asset-gallery-foundrys-index). The returned `entityId` (e.g. `azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/github`) is your `toolEntityId`; its `objectId` segment (`github`) is the `connectorName`.
2. **Confirm it's managed OAuth** — `GET .../managedApis/{connectorName}?api-version=2016-06-01` and check for a `connectionParameters.*.type == "oauthSetting"` entry (this is also where `scopes` / `identityProvider` come from).
3. **Read the MCP server URL** — from the catalog row's `remotes[0].url` when present, else the connector's documented endpoint. When `connectors-registry-prod-bl` lacks it, also check the peer entry in `registry-prod-bl` (e.g. `github-mcp-server`). See [foundry-tool-catalog.md → Body shape — OAuth2 + catalog_MCP](../../create/references/foundry-tool-catalog.md#body-shape--oauth2--catalog_mcp-microsoft-managed-oauth).

> The managed body the portal sends is `authType: OAuth2`, `category: RemoteTool`, `target: <remotes[0].url>`, `credentials: {}` (empty), `metadata: { type: "catalog_MCP", toolEntityId: <entityId> }`. The CLI below produces the same shape.

---

# A. Imperative CLI

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow). Managed OAuth maps to `azd ai connection create --auth-type oauth2` **with `--connector-name` and `--metadata`, but NO `--client-id` / `--client-secret`** — omitting the client credentials is what selects the Foundry-managed app (the CLI marks `--client-id`/`--client-secret` as "required for BYO OAuth2"; leaving them off sends empty `credentials: {}`).

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the managed-OAuth (catalog_MCP) connection — no client id/secret
azd ai connection create github-mcp-managed \
  --kind remote-tool \
  --target https://api.githubcopilot.com/mcp \
  --auth-type oauth2 \
  --connector-name github \
  --metadata type=catalog_MCP \
  --metadata toolEntityId=azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/github \
  --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"

# Write the toolbox spec to a file (create takes a --from-file PATH; stdin '-' not supported)
cat > github-mcp.yaml <<'EOF'
description: github-mcp toolbox (managed OAuth)
connections:
  - name: github-mcp-managed
EOF
```

**Create a new toolbox** (first version auto-promoted):

```bash
azd ai toolbox create github-tools --from-file github-mcp.yaml --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
```

> `azd ai toolbox create` / `delete` require an **azd environment** (run inside an `azd init`'d directory), unlike `connection create` / `toolbox show` which work with just `--project-endpoint`.
>
> Both `azd ai connection create` and `azd ai toolbox create` print a benign `no active azd environment ... run azd init` line even when they **succeed** — check for the `Connection "..." created` / `Created toolbox ...` success line, not the warning.

**Add to an existing toolbox** (new version — then promote):

```bash
azd ai toolbox connection add github-tools github-mcp-managed --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
azd ai toolbox publish github-tools <new-version> --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
```

`connection add` creates a new immutable version but leaves the default unchanged until you `publish` it.

`--from-file` entry:

```yaml
connections:
  - name: github-mcp-managed     # RemoteTool — just the name; connector-name/target/metadata live on the connection
```

> The GitHub Copilot MCP server (`api.githubcopilot.com/mcp`) accepts the **managed** connector's tokens but **rejects BYO OAuth-App tokens** — this is the reverse of the BYO doc's caveat, and a reason to prefer managed for that server. See [foundry-tool-catalog.md caveat](../../create/references/foundry-tool-catalog.md#caveat-apigithubcopilotcommcp-rejects-byo-oauth-app-tokens).

---

# B. Declarative `azure.yaml`

Create the managed-OAuth connection first (section A, step 1), then reference it under `tools:` by its **name** via `project_connection_id`. `azd deploy` upserts the toolbox and auto-promotes the new version.

```yaml
name: my-agent-project
services:
  agent-tools:
    host: azure.ai.toolbox
    tools:
      - type: mcp
        server_label: github_mcp
        project_connection_id: github-mcp-managed   # the connection name from section A
        require_approval: never

  # A hosted agent in the same project consumes the toolbox by name
  my-agent:
    host: azure.ai.agent
    uses:
      - agent-tools          # depend on the toolbox service
    environmentVariables:
      - name: TOOLBOX_NAME
        value: agent-tools    # agent resolves the MCP endpoint at runtime
```

```bash
azd deploy agent-tools
```

**Requirements & gotchas:**

- Set **`FOUNDRY_PROJECT_ENDPOINT` and `AZURE_SUBSCRIPTION_ID`** in the azd env (after it's created) before `azd deploy`, or it errors `infrastructure has not been provisioned`. No `azd provision` / `infra:` block is needed.
- Managed-OAuth MCP uses `project_connection_id: <connection-name>` (not an inline `server_url` — that's the no-auth path).
- The `-32006` consent gate below still applies — the declarative path deploys the connection reference, but the first `tools/list` triggers the same one-time consent.

The agent references the toolbox **by name** (`TOOLBOX_NAME`), so the MCP endpoint resolves at runtime — no endpoint string is hard-coded. See [use-toolbox-in-hosted-agent.md](../../create/references/use-toolbox-in-hosted-agent.md).

---

## Verify & the consent flow end-to-end (2026-07-20)

Call the toolbox endpoint directly with a bearer token + raw `tools/list` (see [test-endpoint.md](test-endpoint.md)). Unlike BYO, the managed flow does **not** call `listConsentLinks` up front — consent is lazy: the first `tools/list` for a user who has **not consented yet** returns the consent gate rather than the tool list:

```jsonc
{"jsonrpc":"2.0","id":2,"error":{"code":-32006,
 "message":"tools/list failed for 1 tool source(s)... {\"errors\":[{\"name\":\"<server_label>\",\"type\":\"mcp\",
   \"error\":{\"code\":\"CONSENT_REQUIRED\",
     \"message\":\"https://logic-apis-<region>.consent.azure-apim.net/login?data=...\"}}]}"}}
```

- The `message` is the **consent URL** (host `logic-apis-<region>.consent.azure-apim.net` — the Foundry connector consent endpoint). Open it in a browser and sign in to grant the connection. No callback-URL registration is needed (Foundry's managed app already allow-lists its own redirect).
- After consent, the toolbox caches the token; the same `tools/list` then returns the MCP's tools, and `tools/call` works.
- This `-32006` gate is the **expected** pre-consent behavior for OAuth2 (both managed and BYO) — not an error to debug.
- **Consent is per-user, per-connection, per-project.** Each new caller hits `CONSENT_REQUIRED` once and must open the URL the toolbox returns.

MCP-sourced tools surface as `{server_label}___{tool_name}` (three underscores) — call them with the prefixed name in `tools/call`. See [toolbox.md § Tool naming](../toolbox.md#tool-naming).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `tools/list` → `-32006 CONSENT_REQUIRED` | Expected on first use. Open the returned consent URL and sign in; retry. |
| `tools/list` returns zero after consent | Wrong `--target` (not the MCP server URL) or the connector needs the `gateway_connector` two-PUT flow instead — see [foundry-tool-catalog.md](../../create/references/foundry-tool-catalog.md). |
| `invalid_payload: unsupported authType` | API version drift — re-check allowed `authType` for `RemoteTool` in the [projects REST API](https://learn.microsoft.com/rest/api/aiservices/). |
| `403 Forbidden` on connection PUT / toolbox POST | Caller lacks **Foundry User** / **Azure AI Developer** on the project — grant at project scope. |
| `tools/call` → `403 ... user may not be registered` | Connector backed by a dogfood OAuth app with a test-user allowlist — not fixable client-side. See [foundry-tool-catalog.md dogfood trap](../../create/references/foundry-tool-catalog.md#dogfood-oauth-app-runtime-allowlist-trap). |

## References

- [MCP tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/mcp)
- [foundry-tool-catalog.md](../../create/references/foundry-tool-catalog.md) — catalog discovery APIs, `catalog_MCP` / `gateway_connector` ARM PUT bodies, consent internals
- [tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md) — BYO OAuth2 app variant
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
