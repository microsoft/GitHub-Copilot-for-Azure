# Tool — Web Search (`type: web_search`)

Basic Bing web search is a **connectionless built-in** — declared under a `tools:` block in the `--from-file` YAML (not via a connection). Bing **Custom Search** (scope grounding to specific domains) needs a `GroundingWithCustomSearch` connection. For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Full flow — basic web search (no connection)

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow) — basic Bing needs no connection:

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# Create the toolbox with web_search under `tools:` (first version auto-promoted)
azd ai toolbox create agent-tools --from-file - <<'EOF'
description: web-search toolbox
tools:
  - type: web_search
    name: web
EOF
```

## Full flow — Bing Custom Search (with connection)

```bash
azd ai connection create my-bing-conn \
  --kind grounding-with-custom-search \
  --auth-type api-key --key "<bing-key>"

azd ai toolbox connection add agent-tools my-bing-conn --instance-name docs-config
azd ai toolbox publish agent-tools <new-version>
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## `--from-file` entries

```yaml
tools:
  - type: web_search           # basic Bing — connectionless
    name: web
connections:
  - name: my-bing-conn         # Custom Search — GroundingWithCustomSearch, needs instance_name
    instance_name: docs-config
```

See [toolbox-azd.md § `--from-file` schema](toolbox-azd.md#--from-file-schema) for the full file shape.

## References

- [Web search tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/web-search)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
