# Tool — Work IQ (`type: work_iq_preview`) — preview

Microsoft 365 work context (mail / meetings / files / chats) via Work IQ. Auth is a `RemoteA2A` OAuth connection (BYO Entra app); each user needs an M365 Copilot license. For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Prerequisites

- A **BYO Entra app** registered for Work IQ OAuth.
- An **M365 Copilot license** per user who invokes the tool.

## Full flow

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow):

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the connection
azd ai connection create work-iq-conn \
  --kind remote-a2a \
  --target <work-iq-a2a-endpoint> \
  --auth-type oauth2 \
  --metadata "client_id=<your-entra-app-client-id>"

# 2-3. Attach to a toolbox, then promote
azd ai toolbox connection add agent-tools work-iq-conn
azd ai toolbox publish agent-tools <new-version>
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## `--from-file` entry

```yaml
connections:
  - name: work-iq-conn         # RemoteA2A
```

See [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) for the full file shape.

## References

- [Work IQ tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/work-iq)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
