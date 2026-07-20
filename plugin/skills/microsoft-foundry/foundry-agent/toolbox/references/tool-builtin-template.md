# Tool — <Built-in tool name> (`type: <built_in_type>`)

<One-line description of what the tool does.> This is a **connectionless built-in** — it has no connection and is declared under a `tools:` block in the `--from-file` YAML.

## Prerequisites

- <Any per-tool prerequisite, e.g. an existing vector store ID; remove this section if none.>

## Toolbox entry shape

```yaml
tools:
  - type: <built_in_type>
    # <type-specific fields, e.g. container: { type: auto }>
```

## Create a **new** toolbox with this tool

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow). A connectionless built-in needs no connection, and `create` auto-promotes the first version — so this is a single `create`:

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# Create the toolbox with the tool under `tools:` (first version auto-promoted)
azd ai toolbox create agent-tools --from-file - <<'EOF'
description: <toolbox description>
tools:
  - type: <built_in_type>
EOF
```

## Add this tool to an **existing** toolbox

Built-ins are not addable with `azd ai toolbox connection add <connection>` (that verb is for connections). Add the tool via a `--from-file` `tools:` block, then promote:

```bash
azd ai toolbox connection add agent-tools --from-file - <<'EOF'
tools:
  - type: <built_in_type>
EOF
azd ai toolbox publish agent-tools <new-version>
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md) (steps 4–7 of the flow are the same for every tool).

## References

- <Public tool documentation link>
- [toolbox.md § The flow](../toolbox.md#the-flow) — the canonical create→deploy steps
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
- [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) — full `--from-file` shape
- [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary) — read before creating a toolbox/connection
