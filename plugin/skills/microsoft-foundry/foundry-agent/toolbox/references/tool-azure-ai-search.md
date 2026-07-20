# Tool — Azure AI Search (`type: azure_ai_search`)

Attach an Azure AI Search index to a toolbox. Connection kind is `cognitive-search` (`CognitiveSearch`). For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Full flow

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow):

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the connection
azd ai connection create my-search-conn \
  --kind cognitive-search \
  --target https://my-search.search.windows.net/ \
  --auth-type api-key --key "<search-admin-key>"

# 2-3. Attach to a toolbox with the index (creates a new version), then promote
azd ai toolbox connection add agent-tools my-search-conn --index contoso-outdoors
azd ai toolbox publish agent-tools <new-version>
#   for a brand-new toolbox instead:
#   azd ai toolbox create agent-tools --from-file tools.yaml   # first version auto-promoted
```

For multiple indexes, add multiple entries with different `--index` values.

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## `--from-file` entry

```yaml
connections:
  - name: my-search-conn       # CognitiveSearch — needs index
    index: contoso-outdoors
```

See [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) for the full file shape.

## References

- [Azure AI Search tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/azure-ai-search)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
