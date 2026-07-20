# Tool — Remote MCP server (`type: mcp`)

Attach a remote MCP server to a toolbox. Connection kind is `remote-tool` (`RemoteTool`). For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Auth modes

| Auth mode | `--auth-type` | Connection needed? | Notes |
|---|---|---|---|
| No auth (public) | — | No | Public server via `server_url`; omit the connection. |
| Static key | `custom-keys` | Yes | e.g. `github_pat` passed as a Bearer token. |
| OAuth (managed connector) | `oauth2` (Foundry-managed) | No | Foundry owns the app registration; first call triggers consent (MCP code `-32006`). |
| OAuth (custom app) | `oauth2` (BYO) | Yes | Your `client_id` / `client_secret`. |
| Agent identity | `agentic-identity` | Yes | Project MI — assign the RBAC role on the target **first**. |
| Entra passthrough | `user-entra-token` | Yes | Proxies the caller's Entra identity. |

## Full flow (static-key example)

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow):

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the connection (skip for a public/no-auth server)
azd ai connection create github-mcp-conn \
  --kind remote-tool --target https://api.githubcopilot.com/mcp \
  --auth-type custom-keys --custom-key Authorization="Bearer ghp_xxx..."

# 2. Create the toolbox (first version auto-promoted) OR attach to an existing one
azd ai toolbox create agent-tools --from-file - <<'EOF'
{ "connections": [{ "name": "github-mcp-conn" }] }
EOF
#   existing toolbox instead:
#   azd ai toolbox connection add agent-tools github-mcp-conn
#   3. azd ai toolbox publish agent-tools <new-version>
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## `--from-file` entry

```yaml
connections:
  - name: github-mcp-conn      # RemoteTool — just the name
```

See [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) for the full file shape.

## References

- [MCP tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/mcp)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
