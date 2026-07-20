# Tool — Code Interpreter (`type: code_interpreter`)

Sandboxed Python execution. Connectionless — declared under a `tools:` block in the `--from-file` YAML rather than via a connection. For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Full flow

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow) — connectionless, so a single `create`:

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# Create the toolbox with code_interpreter under `tools:` (first version auto-promoted)
azd ai toolbox create agent-tools --from-file - <<'EOF'
description: code-interpreter toolbox
tools:
  - type: code_interpreter
    container: { type: auto }
EOF
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## Toolbox entry shape

```yaml
tools:
  - type: code_interpreter
    container: { type: auto }   # `auto` for a fresh sandbox; supply file_ids to preload files
```

- No connection or credentials.

See [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) for the full file shape.

## References

- [Code Interpreter tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/code-interpreter)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
