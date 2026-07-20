# Tool — Fabric IQ (`type: fabric_iq_preview`) — preview

Microsoft Fabric data (Ontology / Fabric data agent / Power BI semantic model) via Fabric IQ. Auth is a Fabric IQ OAuth connection and requires **tenant admin consent**. For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Prerequisite

**Tenant admin consent** for the Fabric IQ OAuth app before any user can invoke the tool.

## Full flow

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow):

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the connection
azd ai connection create fabric-iq-conn \
  --kind remote-tool \
  --target <fabric-iq-mcp-endpoint> \
  --auth-type oauth2

# 2-3. Attach to a toolbox, then promote
azd ai toolbox connection add agent-tools fabric-iq-conn
azd ai toolbox publish agent-tools <new-version>
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## `--from-file` entry

```yaml
connections:
  - name: fabric-iq-conn       # RemoteTool
```

See [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) for the full file shape.

## References

- [Fabric IQ tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/fabric-iq)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
