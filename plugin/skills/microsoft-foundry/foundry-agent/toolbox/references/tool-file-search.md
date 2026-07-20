# Tool — File Search (`type: file_search`)

Vector-store-backed retrieval over uploaded files. Connectionless — the vector store is part of the toolbox, so it's declared under a `tools:` block in the `--from-file` YAML rather than via a connection. For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Prerequisite

A **vector store** in the same project, populated with your uploaded files. Capture its ID.

## Full flow

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow) — connectionless, so a single `create`:

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# Create the toolbox with file_search under `tools:` (first version auto-promoted)
azd ai toolbox create agent-tools --from-file - <<'EOF'
description: file-search toolbox
tools:
  - type: file_search
    file_search: { vector_store_ids: ["<vector-store-id>"] }
EOF
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## Toolbox entry shape

```yaml
tools:
  - type: file_search
    file_search: { vector_store_ids: ["<vector-store-id>"] }
```

- No connection or credentials — auth is the toolbox's own.

See [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) for the full file shape.

## References

- [File Search tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/file-search)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
