# Tool — Remote MCP server, custom OAuth2 app (BYO) (`type: mcp`)

Attach a remote MCP server that authenticates with **your own OAuth2 app** (bring-your-own `client_id` / `client_secret`) to a toolbox. Use this when you own the OAuth app and want to control the client, scopes, and secret yourself — either a **third-party / non-Azure MCP** whose OAuth app you register, or a **private MCP you deployed on Azure** ([custom MCP on Azure Functions](https://learn.microsoft.com/en-us/azure/foundry/mcp/build-your-own-mcp-server?view=foundry)).

> 🚦 Before creating a toolbox/connection either way, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

**Flow at a glance** (the redirect URI is a chicken-and-egg step — the OAuth app and the connection each need something from the other):

1. **Create the OAuth app** and collect the five inputs — [Getting the OAuth2 inputs](#getting-the-oauth2-inputs). Leave the callback URL as a placeholder for now.
2. **Create the connection + toolbox** with those inputs — [A. Imperative CLI](#a-imperative-cli) (or [B. Declarative](#b-declarative-azureyaml)).
3. **Read the connection's reply URL and register it** back on the OAuth app — [Set the connector redirect URI](#set-the-connector-redirect-uri-after-the-connection-exists).
4. **Verify** — the first `tools/list` returns a one-time consent URL — [Verify & the consent flow](#verify--the-consent-flow).

---

# Getting the OAuth2 inputs

BYO OAuth2 needs five inputs — `client-id`, `client-secret`, `authorization-url`, `token-url`, `scopes` — that feed the connection in section A. Where they come from depends on the MCP server's origin.

## Origin 1 — Third-party / non-Azure MCP (you register the OAuth app)

The MCP server is hosted elsewhere (a SaaS, a partner, or your own non-Azure host). You register an OAuth app with **that provider's** identity system and supply all five inputs yourself. Example: a **GitHub OAuth App**.

1. Create the OAuth app at **[github.com/settings/applications/new](https://github.com/settings/applications/new)** (Settings → Developer settings → OAuth Apps → New OAuth App). Set:
   - **Application name** — any label.
   - **Homepage URL** — any valid URL for your app.
   - **Authorization callback URL** — a placeholder for now (e.g. your homepage URL). You'll replace it with the connection's real reply URL after the connection is created — see [Set the connector redirect URI](#set-the-connector-redirect-uri-after-the-connection-exists).
2. On the app page, copy the **Client ID** and **Generate a new client secret**.
3. Map the app's values to the connection inputs:

   | Connection input | GitHub OAuth App value |
   |---|---|
   | `--client-id` | **Client ID** |
   | `--client-secret` | the generated **client secret** |
   | `--authorization-url` | `https://github.com/login/oauth/authorize` |
   | `--token-url` | `https://github.com/login/oauth/access_token` |
   | `--scopes` | the delegated scope(s) your MCP needs, space-delimited — e.g. `read:user` |

Now create the connection (section A), then come back to [Set the connector redirect URI](#set-the-connector-redirect-uri-after-the-connection-exists).

> Any OAuth2 provider works the same way — swap GitHub's two endpoint URLs for your provider's authorize/token URLs, and use its client id/secret/scopes.

## Origin 2 — Azure-hosted MCP you build (starter)

Deploy your own MCP on Azure Functions from the sample template, following [Build and register an MCP server](https://learn.microsoft.com/en-us/azure/foundry/mcp/build-your-own-mcp-server?view=foundry). The deploy creates the Function App **and** its Entra app registration, so four of the five connection inputs come straight from its outputs — you only add a client secret.

Run the steps in order. They set env vars (`FUNC`, `RG`, `APPID`, `IDURI`) that later steps reuse.

**Step 1 — Scaffold and provision the Function App + Entra app.**

```bash
azd init --template remote-mcp-functions-python -e mcpserver-python
azd env set AZURE_SUBSCRIPTION_ID <sub-id>
azd env set AZURE_LOCATION <region>       # e.g. eastus2
azd env set VNET_ENABLED false            # public endpoint (simplest); true for private networking
azd up --no-prompt
```

**Step 2 — Capture the outputs into shell vars** (used by every step below):

```bash
FUNC=$(azd env get-values  | grep AZURE_FUNCTION_NAME   | cut -d'"' -f2)
APPID=$(azd env get-values | grep ENTRA_APPLICATION_ID  | cut -d'"' -f2)
IDURI=$(azd env get-values | grep ENTRA_IDENTIFIER_URI  | cut -d'"' -f2)
TENANT=$(azd env get-values | grep AZURE_TENANT_ID      | cut -d'"' -f2)
RG="rg-$(azd env get-values | grep AZURE_ENV_NAME       | cut -d'"' -f2)"   # template puts resources in rg-<env-name>
```

**Step 3 — Deploy the MCP tool code.** `azd up` provisions infra only — the sample repo's `azure.yaml` has no `services:` mapping, so the Function App starts **empty** and `tools/list` would return `HTTP_404`. Publish one of the sample projects:

```bash
(cd src/FunctionsMcpTool && func azure functionapp publish "$FUNC")   # one of 4 sample projects
```

**Step 4 — Let the MCP's Easy Auth advertise its scope.** Without this the connector's token is rejected with `HTTP_403` even after consent:

```bash
az functionapp config appsettings set --name "$FUNC" --resource-group "$RG" \
  --settings "WEBSITE_AUTH_PRM_DEFAULT_WITH_SCOPES=$IDURI/user_impersonation"
```

The template already sets the Function App's `allowedAudiences` to `$IDURI` and `allowedApplications` to `$APPID` — the same `client-id` the connection uses — so the token validates.

**Step 5 — (optional) Confirm the scope** the server advertises matches what you'll pass as `--scopes`:

```bash
curl -s "https://$FUNC.azurewebsites.net/.well-known/oauth-protected-resource"
# => {"resource":"...","scopes_supported":["api://<identifier-uri>/user_impersonation"]}
```

**Step 6 — Create a client secret** on the Entra app (it lives on the connection, not the toolbox):

```bash
SECRET=$(az ad app credential reset --id "$APPID" --display-name toolbox-oauth2 --years 1 --query password -o tsv)
#   ⚠️ the command prints a WARNING line before the secret — take the LAST line if capturing text.
```

You now have all five connection inputs:

| Connection input | Value |
|---|---|
| `--client-id` | `$APPID` |
| `--client-secret` | `$SECRET` |
| `--authorization-url` | `https://login.microsoftonline.com/$TENANT/oauth2/v2.0/authorize` |
| `--token-url` | `https://login.microsoftonline.com/$TENANT/oauth2/v2.0/token` |
| `--scopes` | `$IDURI/user_impersonation` |

The connection **target** is `https://$FUNC.azurewebsites.net/runtime/webhooks/mcp`. Next: create the connection (section A), then [Set the connector redirect URI](#set-the-connector-redirect-uri-after-the-connection-exists). Tear down with `azd down --purge` (and `az ad app delete --id "$APPID"`) when done.

---

# A. Imperative CLI

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow). Write the toolbox spec to a **file** — `azd ai toolbox create --from-file` takes a **path** (stdin `-` is not supported). Fill the five inputs from your MCP's origin (above).

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the BYO OAuth2 connection (client secret comes from your MCP's origin, above)
azd ai connection create private-mcp-oauth \
  --kind remote-tool --target https://<mcp-host>/runtime/webhooks/mcp \
  --auth-type oauth2 \
  --client-id <client-id> --client-secret <client-secret> \
  --authorization-url <authorization-url> \
  --token-url         <token-url> \
  --scopes "<scopes>" \
  --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"

# Write the toolbox spec to a file
cat > private-mcp.yaml <<'EOF'
description: private-mcp toolbox (BYO OAuth2)
connections:
  - name: private-mcp-oauth
EOF
```

**Create a new toolbox** (first version auto-promoted):

```bash
azd ai toolbox create private-tools --from-file private-mcp.yaml --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
```

> `azd ai toolbox create` / `delete` require an **azd environment** (run inside an `azd init`'d directory), unlike `connection create` / `toolbox show` which work with just `--project-endpoint`.
>
> Both `azd ai connection create` and `azd ai toolbox create` print a benign `no active azd environment ... run azd init` line even when they **succeed** — check for the `Connection "..." created` / `Created toolbox ...` success line, not the warning.

**Add to an existing toolbox** (new version — then promote):

```bash
azd ai toolbox connection add private-tools private-mcp-oauth --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
azd ai toolbox publish private-tools <new-version> --project-endpoint "$FOUNDRY_PROJECT_ENDPOINT"
```

`connection add` creates a new immutable version but leaves the default unchanged until you `publish` it.

`--from-file` entry:

```yaml
connections:
  - name: private-mcp-oauth     # RemoteTool — just the name; client-id/secret + URLs live on the connection
```

## Set the connector redirect URI (after the connection exists)

Foundry generates a **per-connection reply URL** when the connection is created. The OAuth app you set up in [Getting the OAuth2 inputs](#getting-the-oauth2-inputs) must whitelist this exact URL, or consent fails with an `AADSTS...redirect_uri` mismatch.

**1. Read the reply URL from the connection** (the data-plane `azd ai connection show` does **not** expose it — use the ARM control-plane record):

```bash
az rest --method get --query "properties.redirectUrl" -o tsv \
  --url "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/projects/<project>/connections/private-mcp-oauth?api-version=2025-06-01"
# => https://global.consent.azure-apim.net/redirect/<connector-guid>
```

**2. Register that exact value back on your OAuth app:**

- **Origin 1 (GitHub / third-party):** paste it into the OAuth app's **Authorization callback URL** field (replacing the placeholder).
- **Origin 2 (Azure / Entra):** add it to the app registration's **web** redirect URIs — `az ad app update --id <ENTRA_APPLICATION_ID> --web-redirect-uris <redirectUrl>`.

> The base is always `https://global.consent.azure-apim.net/redirect/`, but the trailing `<connector-guid>` is **unique per connection** — read it back rather than guessing.

---

# B. Declarative `azure.yaml`

Declare the toolbox as a `host: azure.ai.toolbox` service in `azure.yaml`; `azd deploy` upserts it (and auto-promotes the new version). Create the OAuth2 connection first (section A, step 1), then reference it under `tools:` by its **name** via `project_connection_id`.

```yaml
name: my-agent-project
services:
  agent-tools:
    host: azure.ai.toolbox
    tools:
      - type: mcp
        server_label: private_mcp
        project_connection_id: private-mcp-oauth   # the connection name from section A
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
- Authed MCP servers (static key, OAuth, agent identity, Entra passthrough) all use `project_connection_id: <connection-name>`; no-auth servers use inline `server_url`.
- The `-32006` consent gate below still applies — the declarative path deploys the connection reference, but the first `tools/list` triggers the same one-time consent.

The agent references the toolbox **by name** (`TOOLBOX_NAME`), so the MCP endpoint resolves at runtime — no endpoint string is hard-coded. See [use-toolbox-in-hosted-agent.md](../../create/references/use-toolbox-in-hosted-agent.md).

---

## Verify & the consent flow end-to-end (2026-07-20)

Call the toolbox endpoint directly with a bearer token + raw `tools/list` (see [test-endpoint.md](test-endpoint.md)). For a BYO OAuth2 connection whose user has **not consented yet**, `tools/list` returns the consent gate rather than the tool list:

```jsonc
{"jsonrpc":"2.0","id":2,"error":{"code":-32006,
 "message":"tools/list failed for 1 tool source(s)... {\"errors\":[{\"name\":\"<server_label>\",\"type\":\"mcp\",
   \"error\":{\"code\":\"CONSENT_REQUIRED\",
     \"message\":\"https://logic-apis-<region>.consent.azure-apim.net/login?data=...\"}}]}"}}
```

- The `message` is the **consent URL** (host `logic-apis-<region>.consent.azure-apim.net` — the Foundry connector consent endpoint, **not** a raw `login.microsoftonline.com` URL). Open it in a browser and sign in to grant the connection.
- After consent, the toolbox caches the token; the same `tools/list` then returns the MCP's tools, and `tools/call` works.
- This `-32006` gate is the **expected** pre-consent behavior for OAuth2 (both BYO and managed connector) — not an error to debug. If consent succeeds but `tools/list` then returns `-32007 HTTP_403` or `HTTP_404`, the MCP **server** needs config — see [Origin 2](#origin-2--azure-hosted-mcp-you-build-starter) and [Troubleshooting](#troubleshooting).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `tools/list` → `-32006 CONSENT_REQUIRED` | Expected on first use. Open the returned consent URL and sign in; retry. |
| `tools/list` → `-32007 HTTP_403` after consenting | Consent succeeded, but the MCP server rejected the token. Its Easy Auth doesn't advertise the scope — set `WEBSITE_AUTH_PRM_DEFAULT_WITH_SCOPES=<ENTRA_IDENTIFIER_URI>/user_impersonation` on the Function App (see [Origin 2](#origin-2--azure-hosted-mcp-you-build-starter)). |
| `tools/list` → `-32007 HTTP_404` | Auth passed but the server has no tools at `/runtime/webhooks/mcp` — the MCP code isn't deployed. Publish a sample with `func azure functionapp publish <app>` (see [Origin 2](#origin-2--azure-hosted-mcp-you-build-starter)). |
| `AADSTS...redirect_uri` mismatch after clicking consent | The connection's reply URL isn't registered on your app. Read `properties.redirectUrl` from the connection (see [Set the connector redirect URI](#set-the-connector-redirect-uri-after-the-connection-exists)) and add it to the app's redirect URIs. |
| `invalid_client` at the token step | Wrong `--client-secret` (expired/mistyped) or `--client-id`. Reset the secret and recreate the connection. |
| `tools/list` returns zero after consent | Scope mismatch — `--scopes` must match the MCP's `scopes_supported` from `/.well-known/oauth-protected-resource`. |

## References

- [Build and register an MCP server (custom MCP on Azure Functions)](https://learn.microsoft.com/en-us/azure/foundry/mcp/build-your-own-mcp-server?view=foundry)
- [MCP tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/mcp)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types) — all six MCP auth modes at a glance, each linking to its own reference
