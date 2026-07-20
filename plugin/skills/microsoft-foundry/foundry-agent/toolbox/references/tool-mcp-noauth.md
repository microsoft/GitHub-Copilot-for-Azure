# Tool — Remote MCP server, no auth (`type: mcp`)

Attach a **public** remote MCP server (no credentials) to a toolbox. Because there are no credentials, no connection is created — the server is referenced directly by `server_url` under a `tools:` block. For authenticated MCP servers (static key, OAuth, agent identity, Entra passthrough), see [tool-mcp.md](tool-mcp.md).

## Toolbox entry shape

```yaml
tools:
  - type: mcp
    server_label: <short-label>
    server_url: https://<public-mcp-endpoint>
```

- `server_label` — becomes the tool-name prefix (`{server_label}___{tool_name}`).
- No `project_connection_id` — the server is public.

## Create a **new** toolbox with this tool

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow). A no-auth server needs no connection, and `create` auto-promotes the first version — so this is a single `create`:

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# Create the toolbox with the MCP server under `tools:` (first version auto-promoted)
azd ai toolbox create agent-tools --from-file - <<'EOF'
description: <toolbox description>
tools:
  - type: mcp
    server_label: <short-label>
    server_url: https://<public-mcp-endpoint>
EOF
```

## Add this tool to an **existing** toolbox

A no-auth MCP server has no connection, so add it via a `--from-file` `tools:` block (not `azd ai toolbox connection add <connection>`), then promote:

```bash
azd ai toolbox connection add agent-tools --from-file - <<'EOF'
tools:
  - type: mcp
    server_label: <short-label>
    server_url: https://<public-mcp-endpoint>
EOF
azd ai toolbox publish agent-tools <new-version>
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md) (steps 4–7 of the flow are the same for every tool).

## References

- [MCP tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/mcp)
- [tool-mcp.md](tool-mcp.md) — authenticated MCP variants (static key, OAuth, agent identity, Entra passthrough)
- [toolbox.md § The flow](../toolbox.md#the-flow) — the canonical create→deploy steps
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
- [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) — full `--from-file` shape
- [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary) — read before creating a toolbox/connection
