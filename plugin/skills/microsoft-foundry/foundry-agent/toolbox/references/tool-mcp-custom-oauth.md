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

Building your own MCP on Azure Functions? The sample template's `azd up` emits four of the five inputs (client-id, authorization-url, token-url, scopes) plus the target; you only add a client secret. Full 6-step recipe: [tool-mcp-custom-oauth-azure-starter.md](tool-mcp-custom-oauth-azure-starter.md). Come back here for section A once you have the inputs.

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

> `azd ai toolbox create` / `delete` require an **azd environment** (run inside an `azd init`'d directory). Both `connection create` and `toolbox create` print a benign `no active azd environment` line even on success — check for the `Connection "..." created` / `Created toolbox ...` success line, not the warning.

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
- The `-32006` consent gate still applies — the declarative path deploys the connection reference, but the first `tools/list` triggers the same one-time consent (see [test-endpoint.md § OAuth consent flow](test-endpoint.md#oauth-consent-flow--32006)).

The agent references the toolbox **by name** (`TOOLBOX_NAME`), so the MCP endpoint resolves at runtime — no endpoint string is hard-coded. See [use-toolbox-in-hosted-agent.md](../../create/references/use-toolbox-in-hosted-agent.md).

---

## Verify

Call the toolbox endpoint directly with a bearer token + raw `tools/list` — see [test-endpoint.md](test-endpoint.md). For a BYO OAuth2 connection, the first `tools/list` for an un-consented user returns the `-32006` consent gate; the flow and the consent/redirect troubleshooting are in [test-endpoint.md § OAuth consent flow](test-endpoint.md#oauth-consent-flow--32006).

## References

- [Build and register an MCP server (custom MCP on Azure Functions)](https://learn.microsoft.com/en-us/azure/foundry/mcp/build-your-own-mcp-server?view=foundry)
- [MCP tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/mcp)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types) — all six MCP auth modes at a glance, each linking to its own reference
