# Tool — OpenAPI (`type: openapi`)

Expose a REST API to the agent via its OpenAPI 3.x spec. For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Auth modes

| Auth | Connection needed? | Notes |
|---|---|---|
| `connection` (static key) | Yes | `custom-keys` connection supplies the API key; set `connection_auth`. |
| `managed_identity` | No | Uses the project MI + an `audience` (target resource URI); grant the MI RBAC on the target or calls return `401`. |

## Full flow (key auth)

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow):

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the connection (key auth; skip for managed_identity)
azd ai connection create my-api-conn \
  --kind remote-tool \
  --target https://api.example.com \
  --auth-type custom-keys \
  --custom-key Authorization="Bearer <api-key>"

# 2-3. Attach to a toolbox, then promote
azd ai toolbox connection add agent-tools my-api-conn
azd ai toolbox publish agent-tools <new-version>
```

For `managed_identity` auth, no connection is created — supply the `audience` in the tool entry instead.

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

> Multiple `openapi` entries are allowed in one toolbox only if each spec defines a distinct `info.title`. See [toolbox.md § Multi-tool rule](../toolbox.md#multi-tool-rule).

## References

- [OpenAPI tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/openapi)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
