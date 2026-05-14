# Toolbox & Tool CRUD — azd

Use **azd (Azure Developer CLI) with `agent.manifest.yaml`** to provision a toolbox and its tools as code. Best for **initial creation** and **bulk re-deploy from a source-controlled manifest**.

> ⚠️ **azd capability is limited to create + re-deploy.** It cannot list, get, promote a default version, or delete a single toolbox. For those, use [crud-toolbox-python-sdk.md](crud-toolbox-python-sdk.md) or [crud-toolbox-rest.md](crud-toolbox-rest.md).
>
> ⚠️ **Validation status:** YAML shapes in this doc are derived from the official `foundry-samples` repo and cross-checked against the SDK/REST schemas that **were** live-validated (May 2026). The azd `up`/`deploy` flow itself was not executed end-to-end against the reference project — see "Validation notes" at the end.

## Mental Model

- A **toolbox** is the parent resource; each `azd up` produces a **new immutable toolbox version**, and the first version becomes `default_version`.
- Tools live as an **array inside the toolbox** in the manifest. To add / update / remove a tool, edit the `tools:` array and re-run `azd up` — this creates a new version with all tools as defined. Old versions remain until manually deleted (SDK/REST only).
- azd does **not** promote new versions to `default_version` automatically beyond the first one. After the first deploy, version promotion requires the SDK or REST.

### Multi-tool naming requirement

Same validator rule that applies to SDK/REST: if a version has more than one tool, **every tool must have a unique identifier** (`name:` for most types, `server_label:` for `mcp`). `azure_ai_search`, `openapi`, and `a2a_preview` do **not** support `name:` — keep them in single-tool versions or pair them only with named tools (and even then expect at most one of these unnamed types per version).

## Capability Matrix

| Operation | Supported by azd? |
|-----------|-------------------|
| Create toolbox + first version | ✅ via manifest + `azd up` |
| Re-deploy a new version with edited tools | ✅ edit manifest, `azd up` |
| List toolboxes | ❌ (use SDK / REST) |
| Get toolbox metadata | ❌ (use SDK / REST) |
| Promote a version to `default_version` | ❌ (use SDK / REST) |
| Delete a single toolbox | ❌ — `azd down` tears down the whole project |
| Delete a toolbox version | ❌ (use SDK / REST) |

## Manifest Skeleton

`agent.manifest.yaml` at the project root:

```yaml
parameters:
  # Optional: secrets / env-driven values referenced by `{{ name }}`
  some_secret:
    secret: true
    description: A secret value
resources:
  - kind: model
    id: gpt-4o
    name: AZURE_AI_MODEL_DEPLOYMENT_NAME
  - kind: connection         # Optional: only for tools that need credentials
    name: my-connection
    category: RemoteTool
    authType: CustomKeys
    target: https://example.com
    credentials:
      type: CustomKeys
      keys:
        Authorization: "Bearer {{ some_secret }}"
  - kind: toolbox
    name: agent-tools        # ← toolbox name; used in the MCP endpoint URL
    tools:
      - type: web_search     # ← tool entries (see per-type sections below)
```

Provision:

```bash
azd up
# or, after the first up:
azd provision   # infra only
azd deploy      # code/manifest only
```

Tear down (deletes the **entire project**, not just the toolbox):

```bash
azd down
```

## Add / Update / Remove a Tool

There is no per-tool azd command — every tool change is a manifest edit + redeploy:

1. **Edit `agent.manifest.yaml`** — add, replace, or remove entries in the `tools:` array under the `kind: toolbox` resource. If the new array has >1 tool, ensure each entry has `name:` (or `server_label:` for `mcp`).
2. **Add any new connections** the new tools need (`kind: connection` blocks) and supply secrets via `parameters:`.
3. **Run `azd deploy`** (or `azd up` if infra also changed). This creates a **new toolbox version** containing the full tools array as defined.
4. **Promote the new version** — azd does not do this. Use the SDK or REST:
   - SDK: `client.beta.toolboxes.update(name="agent-tools", default_version="<new>")`
   - REST: `PATCH /toolboxes/agent-tools?api-version=v1` with `{ "default_version": "<new>" }`

To **discover the new version number**, list versions with the SDK (`list_versions(name=...)`) or REST (`GET /toolboxes/{n}/versions`). To **revert**, promote the older version back; old versions are not deleted automatically.

## Tool YAML by Type

All entries go inside `tools:` under a `kind: toolbox` resource. Tool types match the values in [SUPPORTED_TOOLBOX_TOOLS.md](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md).

### `web_search` (Bing Grounding)

```yaml
tools:
  - type: web_search
  # Add `name: web` if combined with other tools in the same toolbox.
```

No additional config required for the default Bing Grounding instance. For custom Bing Search resources, use the SDK or REST path — the manifest sample folder does not include a custom-search example.

### `azure_ai_search`

```yaml
tools:
  - type: azure_ai_search
    index_name: my-index
    project_connection_id: my-search-connection
```

⚠️ Does not accept `name:`. Keep this in a single-tool toolbox version, or only combine with one other tool that itself has no `name`.

Sample: [`azd-samples/ai-search/agent.manifest.yaml`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/azd/azd-samples/ai-search/agent.manifest.yaml).

### `code_interpreter`

```yaml
tools:
  - type: code_interpreter
  # Add `name: code` if combined with other tools.
```

Sample: [`azd-samples/code-interpreter/agent.manifest.yaml`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/azd/azd-samples/code-interpreter/agent.manifest.yaml).

### `file_search`

```yaml
tools:
  - type: file_search
    name: docs                 # required if alongside other tools
    vector_store_ids:          # ← top-level on the tool entry, NOT under `file_search:`
      - vs_abc123
```

> **Correction vs official sample:** `vector_store_ids` is top-level on the tool object. Live REST validation against the same schema confirmed the validator expects `tools[N].vector_store_ids`, not `tools[N].file_search.vector_store_ids`.

Sample: [`azd-samples/file-search/agent.manifest.yaml`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/azd/azd-samples/file-search/agent.manifest.yaml).

### `mcp` (remote MCP server)

```yaml
parameters:
  github_pat:
    secret: true
    description: GitHub Personal Access Token
resources:
  - kind: connection
    name: github-mcp-conn
    category: RemoteTool
    authType: CustomKeys
    target: https://api.githubcopilot.com/mcp
    credentials:
      type: CustomKeys
      keys:
        Authorization: "Bearer {{ github_pat }}"
  - kind: toolbox
    name: agent-tools
    tools:
      - type: mcp
        server_label: github           # acts as the unique identifier; no `name:` needed
        project_connection_id: github-mcp-conn
        require_approval: never        # or `always`
        # Optional:
        # allowed_tools: [search_repos, get_issue]
        # headers: { X-Custom: value }
```

Sample: [`azd-samples/mcp-keyauth/agent.manifest.yaml`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/azd/azd-samples/mcp-keyauth/agent.manifest.yaml).

For a public no-auth MCP server (e.g. Microsoft Learn), still create a `CustomKeys` connection with a placeholder key:

```yaml
  - kind: connection
    name: learn-mcp-conn
    category: RemoteTool
    authType: CustomKeys
    target: https://learn.microsoft.com/api/mcp
    credentials:
      type: CustomKeys
      keys:
        x-empty: none
```

### `openapi`

```yaml
tools:
  - type: openapi
    openapi:
      name: my-api               # this is the API name, not the tool identifier
      spec:
        openapi: 3.0.0
        info: { title: My API, version: 1.0.0 }
        paths: { ... }
      auth:
        type: connection
        security_scheme:
          project_connection_id: my-api-connection
```

⚠️ Tool entry does not accept `name:`. Same multi-tool caveat as `azure_ai_search`.

Sample: [`azd-samples/openapi-keyauth/agent.manifest.yaml`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/azd/azd-samples/openapi-keyauth/agent.manifest.yaml).

### `a2a_preview` (Agent-to-Agent)

> ⚠️ Specify **exactly one** of `base_url` or `project_connection_id`. Including both fails at MCP runtime with `A2A tool config must specify exactly one of 'base_url' or 'project_connection_id', not both`.

```yaml
tools:
  - type: a2a_preview
    project_connection_id: target-agent-connection
    # OR
    # base_url: https://example.com/agent
```

⚠️ Tool entry does not accept `name:`. Same multi-tool caveat as above.

Sample: [`azd-samples/a2a/agent.manifest.yaml`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/azd/azd-samples/a2a/agent.manifest.yaml).

## Connection Auth Types

Connections supply credentials to tools. Reference them from a tool via `project_connection_id: <connection-name>`.

| `authType` | Use for | Required keys |
|-----------|---------|---------------|
| `CustomKeys` | API keys, bearer tokens, or placeholder for anonymous | `credentials.type: CustomKeys`, `credentials.keys: { ... }` |
| `OAuth2` (managed) | Built-in OAuth connectors (e.g. GitHub) | `connectorName: <managed-connector>` |
| `OAuth2` (custom) | Custom OAuth provider | `authorizationUrl`, `tokenUrl`, `refreshUrl`, `credentials.clientID`, `credentials.clientSecret` |
| `AgenticIdentity` | Entra ID (workload identity) | `audience: <resource-audience>` |
| `UserEntraToken` | On-Behalf-Of user token | `audience: <resource-audience>` |

`CustomKeys` is the only auth type live-validated end-to-end (via the equivalent ARM call — see [crud-toolbox-rest.md#connections-required-for-most-tools](crud-toolbox-rest.md#connections-required-for-most-tools)). `OAuth2` schema details are not publicly documented and may require Portal-based creation; see the same section.

## Validation Notes

| Validation | Status |
|------------|--------|
| Manifest YAML shapes vs official `foundry-samples` repo | ✅ Cross-checked May 2026 |
| Equivalent tool-type request bodies (web_search, code_interpreter, file_search, mcp, azure_ai_search, openapi anon, a2a_preview) | ✅ Live-validated via REST against project `xiaofhua-toolbox-009` |
| `file_search.vector_store_ids` top-level placement | ✅ Live-validated via REST (validator error confirmed location) |
| Multi-tool naming requirement | ✅ Live-validated via REST and SDK |
| `CustomKeys` connection (key auth + placeholder for anonymous) | ✅ Live-validated via ARM |
| `OAuth2` connection schema | ❌ Not publicly documented; recommend Portal creation |
| End-to-end `azd up` / `azd deploy` against the reference project | ⚠️ Not executed — manifest path inferred from samples + validated equivalents |

## Sources

- [Toolbox docs — azd tab](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [`samples/python/toolbox/azd/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/azd) — full manifest examples per tool type
- [`SUPPORTED_TOOLBOX_TOOLS.md`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md)
- For per-operation REST/SDK equivalents the manifest compiles into, see [crud-toolbox-rest.md](crud-toolbox-rest.md) and [crud-toolbox-python-sdk.md](crud-toolbox-python-sdk.md)
