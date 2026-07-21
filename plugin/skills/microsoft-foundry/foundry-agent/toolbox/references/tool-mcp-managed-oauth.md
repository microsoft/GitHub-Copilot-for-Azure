# Tool — Remote MCP server, OAuth (Foundry-managed connector) (`type: mcp`)

Attach a remote MCP server whose OAuth is **brokered by Foundry** — you do **not** supply `client_id` / `client_secret`. Use when the MCP server appears as a **catalog tile** ("Custom · Preview" / a connector-namespace connector) and you accept Microsoft's managed OAuth app. Foundry owns the app registration, token storage, and refresh; the first `tools/list` triggers a one-time per-user consent.

For the variant where you own the OAuth app (BYO `client_id` / `client_secret`), see [tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md). For the connector-namespace `gateway_connector` variant, see [foundry-tool-catalog.md → Gateway connector full flow](../../create/references/foundry-tool-catalog.md#gateway-connector-full-flow).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

**Flow at a glance:**

1. **List the managed-OAuth connectors** — run the discovery script with `--managed-only` — [Getting the catalog inputs](#getting-the-catalog-inputs).
2. **Check the user's connector is in that list.** If so, take its `connectorName` / `toolEntityId` / `serverUrl` from the row. If **not** listed, this reference doesn't apply — the connector is BYO-OAuth ([tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md)), key-auth ([tool-mcp-key-auth.md](tool-mcp-key-auth.md)), or no-auth ([tool-mcp-noauth.md](tool-mcp-noauth.md)); switch references.
3. **Create the connection + toolbox** — no client id/secret; Foundry brokers the app — [A. Imperative CLI](#a-imperative-cli) (or [B. Declarative](#b-declarative-azureyaml)).
4. **Verify** — the first `tools/list` returns a one-time consent URL (`-32006`); open it, sign in, retry — [Verify](#verify).

There is **no redirect-URI round-trip** and **no `client_secret`** to manage — the two things the managed flow removes versus [tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md).

---

# Getting the catalog inputs

**Step 1 — list the connectors Foundry can broker OAuth for**, then **check the user's is in that list**. Run the discovery script with `--managed-only`; each row is a usable connector:

```bash
../scripts/get-catalog-inputs.sh github --managed-only     # bash
pwsh ../scripts/get-catalog-inputs.ps1 github -ManagedOnly  # PowerShell
```

Drop `--managed-only` / `-ManagedOnly` to see every match with a `managedOAuth: true|false` column (to confirm *why* a wanted connector is excluded). Each managed row also reports `identityProvider` and default `scopes`.

- **User's connector is listed** → take its `connectorName`, `toolEntityId`, and `serverUrl` and continue to [A. Imperative CLI](#a-imperative-cli).
- **Not listed** → this reference doesn't apply — BYO-OAuth ([tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md)), key-auth ([tool-mcp-key-auth.md](tool-mcp-key-auth.md)), or no-auth ([tool-mcp-noauth.md](tool-mcp-noauth.md)); switch references.

The two connection inputs the row gives you: the **MCP server URL** (→ `--target`) and **`toolEntityId`** (→ `--metadata`).

> ⚠️ **`serverUrl` is often empty** — `remotes[].url` is `null` for many tiles. When empty, supply the connector's **documented** MCP endpoint as `--target` (e.g. github Copilot → `https://api.githubcopilot.com/mcp`). The script still recovers `toolEntityId` + `connectorName` reliably.

---

# A. Imperative CLI

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow). Managed OAuth maps to `azd ai connection create --auth-type oauth2` **with `--connector-name` and `--metadata`, but NO `--client-id` / `--client-secret`** — omitting the client credentials selects the Foundry-managed app (leaving them off sends empty `credentials: {}`).

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

> `toolbox create` / `delete` require an **azd environment** (run inside an `azd init`'d dir). `connection create` and `toolbox create` print a benign `no active azd environment` line even on success — check for the `... created` line, not the warning.

**Add to an existing toolbox** (new version — then promote):

```bash
azd ai toolbox connection add github-tools github-mcp-managed --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
azd ai toolbox publish github-tools <new-version> --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
```

`connection add` creates a new immutable version; the default stays unchanged until you `publish`.

> The GitHub Copilot MCP server (`api.githubcopilot.com/mcp`) accepts the **managed** connector's tokens but **rejects BYO OAuth-App tokens** — the reverse of the BYO doc's caveat, and a reason to prefer managed for that server. See [foundry-tool-catalog.md caveat](../../create/references/foundry-tool-catalog.md#caveat-apigithubcopilotcommcp-rejects-byo-oauth-app-tokens).

---

# B. Declarative `azure.yaml`

Create the managed-OAuth connection first (section A, step 1), then reference it by name via `project_connection_id` and `azd deploy agent-tools` — the same `host: azure.ai.toolbox` shape as every MCP variant. See [tool-mcp-noauth.md § B](tool-mcp-noauth.md#b-declarative-azureyaml) for the full `azure.yaml` skeleton.

```yaml
    tools:
      - type: mcp
        server_label: github_mcp
        project_connection_id: github-mcp-managed   # the connection name from section A
        require_approval: never
```

The `-32006` consent gate below still applies — the first `tools/list` triggers the same one-time consent.

---

## Verify

Call `tools/list` against the endpoint — see [test-endpoint.md](test-endpoint.md). The first call for an un-consented user returns the `-32006` consent gate (managed differs only in that Foundry's app already allow-lists its own redirect — no callback registration). See [test-endpoint.md § OAuth consent flow](test-endpoint.md#oauth-consent-flow--32006).

MCP-sourced tools surface as `{server_label}___{tool_name}` (three underscores). See [mcp-protocol.md § Tool naming](mcp-protocol.md#tool-naming).

### Managed-connector troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `tools/list` returns zero after consent | Wrong `--target` (not the MCP server URL), or the connector needs the `gateway_connector` two-PUT flow instead — see [foundry-tool-catalog.md](../../create/references/foundry-tool-catalog.md). |
| `invalid_payload: unsupported authType` | API version drift — re-check allowed `authType` for `RemoteTool` in the [projects REST API](https://learn.microsoft.com/rest/api/aiservices/). |
| `403 Forbidden` on connection PUT / toolbox POST | Caller lacks **Foundry User** / **Azure AI Developer** on the project — grant at project scope. |

## References

- [MCP tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/mcp)
- [foundry-tool-catalog.md](../../create/references/foundry-tool-catalog.md) — catalog discovery APIs, ARM PUT bodies, consent internals
- [tool-mcp-custom-oauth.md](tool-mcp-custom-oauth.md) — BYO OAuth2 app variant
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
