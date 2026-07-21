# Manage Tools & Toolboxes with `azd ai`

The full `azd ai toolbox` CLI surface — creating, editing, versioning, and teardown. For the create→consume walkthrough and per-tool flows, see [toolbox.md § Create & use a toolbox (happy path)](../toolbox.md#create--use-a-toolbox-happy-path) and the [Supported tool types](../toolbox.md#supported-tool-types) table.

## CLI surface

| Command | What it does |
|---------|--------------|
| `azd extension install azure.ai.toolboxes` | Install the toolbox CLI extension (once). |
| `azd ai toolbox create <name> --from-file <path>` | Create toolbox + its first version. File must list at least one connection, skill, or tool. |
| `azd ai toolbox connection add <toolbox> <connection> [--index ...] [--instance-name ...]` | Attach one; creates a new version (default unchanged). |
| `azd ai toolbox connection add <toolbox> --from-file <path>` | Attach many in one call; ONE new version (default unchanged). |
| `azd ai toolbox connection remove <toolbox> <connection>` | Detach; creates a new version (default unchanged). Refuses to leave zero tools. |
| `azd ai toolbox show <name> [--version <ver>]` | Show toolbox + MCP endpoint URL. |
| `azd ai toolbox list` | List toolboxes. |
| `azd ai toolbox versions list <toolbox>` | List versions. |
| `azd ai toolbox publish <name> <version>` | Promote a version to default (also used to roll back). |
| `azd ai toolbox delete <name> [--version <ver>] [--force]` | Delete toolbox or one version. |

Every mutation publishes a new immutable version but does **not** change the default; run `azd ai toolbox publish <name> <version>` to promote one.

## `--from-file` schema

The YAML/JSON passed to `azd ai toolbox create --from-file` or `azd ai toolbox connection add --from-file` lists the connections to bundle, plus a `tools:` block for connectionless built-ins.

```yaml
description: research toolbox    # only on `create`
connections:
  - name: my-mcp                 # RemoteTool
  - name: my-search              # CognitiveSearch -- needs index
    index: products
  - name: my-a2a                 # RemoteA2A
tools:                           # connectionless built-ins (optional)
  - type: web_search
    name: web
  - type: code_interpreter
    container: { type: auto }
  - type: file_search
    vector_store_ids: ["<vector-store-id>"]   # flat: sibling of type, NOT nested under file_search
  - type: toolbox_search_preview
```

- `description` is honored only on `create` (it names the first version).
- At least one of `connections`, `skills`, or `tools` must be non-empty.
- The `connections:` block is a **CLI convenience alias** — the CLI expands each entry into the corresponding nested tool (e.g. `CognitiveSearch` → an `azure_ai_search` tool). The raw toolbox API accepts only the `tools:` array, so a hand-rolled API payload must use the tool shape directly.
- Attaching many entries in one `--from-file` call produces **one** new version. `create` publishes it as the first (default) version; `connection add` leaves the default unchanged until you `publish`.

### Per-connection-kind fields

| Connection kind | Extra field(s) | Notes |
|-----------------|----------------|-------|
| `RemoteTool` (MCP) | — | Just `name`. |
| `CognitiveSearch` (Azure AI Search) | `index` | One entry per index; repeat with different `index` values for multiple indexes. |
| `RemoteA2A` (A2A peer) | — | Just `name`. |

### Connectionless built-in tools (`tools:` block)

Built-ins with no connection are declared directly under `tools:` (not `connections:`):

| `type` | Extra field(s) | Notes |
|--------|----------------|-------|
| `web_search` | — | Basic Bing. For Bing Custom Search, use a `GroundingWithCustomSearch` **connection** instead. |
| `code_interpreter` | `container: { type: auto }` | Sandboxed Python. |
| `file_search` | `vector_store_ids` | Flat: `vector_store_ids: ["vs_..."]` as a sibling of `type` (NOT nested under `file_search:`). Requires an existing vector store ID. |
| `toolbox_search_preview` | — | Tool Search directive; **counts** as the toolbox's one allowed unnamed tool. |

> Client-side function calling (`FunctionTool`) is **not** a toolbox tool type — it's declared on the prompt agent directly.

## References

- [toolbox.md](../toolbox.md) — concept, create flow, supported tool types, troubleshooting
- [Toolbox (Configure tools)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools)
- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Foundry Toolkit (VS Code) — set up tools/toolboxes](https://code.visualstudio.com/docs/intelligentapps/tool-catalog)
- [Foundry Portal](https://ai.azure.com/)
