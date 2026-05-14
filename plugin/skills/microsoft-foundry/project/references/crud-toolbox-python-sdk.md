# Toolbox & Tool CRUD — Python SDK

Full CRUD support for toolboxes and versions via the **`azure-ai-projects`** Python SDK. This is the **preferred path for management operations** since azd cannot do them.

> ✅ Every operation, kwarg name, and tool constructor in this doc is **live-validated** against `azure-ai-projects==2.1.0a20260408001` and a real Foundry project (May 2026). See "Validation notes" at the end.

## Mental Model

- A **toolbox** is the parent object (`name`, `default_version`); it has many **immutable versions** (integer strings: `"1"`, `"2"`, …).
- Tools live as a **list passed to `create_version()`**. There is no per-tool method — adding / updating / removing a tool means building a new tools list, calling `create_version()`, then promoting the new version with `update(default_version=...)`.

### Multi-tool naming requirement

If a version has more than one tool, **every tool must have a unique identifier**:
- `name=` for `WebSearchTool`, `CodeInterpreterTool`, `FileSearchTool`, `MCPTool`
- `server_label=` for `MCPTool` (also acts as identifier)
- `AzureAISearchTool`, `OpenApiTool`, `A2APreviewTool` **do not have a `name` parameter** — if you put two of these in the same version, the API rejects with `invalid_payload`. Workaround: keep them in single-tool versions, or combine them with named tools only.

Single-tool versions are fine without a name.

## Setup

```bash
pip install --pre azure-ai-projects azure-identity
```

Verified version: `2.1.0a20260408001` (May 2026). Use `--pre` until 2.1.0 GA.

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

ENDPOINT = "https://<account>.services.ai.azure.com/api/projects/<project>"

client = AIProjectClient(endpoint=ENDPOINT, credential=DefaultAzureCredential())
toolboxes = client.beta.toolboxes
```

All toolbox operations are under `client.beta.toolboxes`. The first positional argument on every method is **`name`** (the toolbox name) — not `toolbox_name`.

## Toolbox CRUD

### Create a toolbox + first version

`create_version()` creates the toolbox if it doesn't exist, and adds a new version regardless. The first version is automatically set as `default_version`.

```python
from azure.ai.projects.models import WebSearchTool, MCPTool

v1 = toolboxes.create_version(
    name="example-toolbox",
    tools=[
        WebSearchTool(name="web"),
        MCPTool(server_label="github",
                server_url="https://api.githubcopilot.com/mcp",
                project_connection_id="github-mcp-key-conn",
                require_approval="never"),
    ],
    description="Initial version",
)
print(v1.version)   # → "1"
```

### List toolboxes

```python
for tb in toolboxes.list():
    print(tb.name, tb.default_version)
```

### Get a toolbox

```python
tb = toolboxes.get(name="example-toolbox")
print(tb.default_version)
```

### Promote a version to `default_version`

This is the **partial update** that activates a new version for the MCP endpoint:

```python
toolboxes.update(name="example-toolbox", default_version="2")
```

### Delete a toolbox (and all its versions)

```python
toolboxes.delete(name="example-toolbox")
```

## Toolbox Version CRUD

### List versions

```python
for v in toolboxes.list_versions(name="example-toolbox"):
    print(v.version, [t.type for t in v.tools])
```

### Get a specific version (with tools)

```python
v = toolboxes.get_version(name="example-toolbox", version="1")
```

### Delete a version

```python
toolboxes.delete_version(name="example-toolbox", version="1")
```

You cannot delete the version that is currently `default_version` — promote a different one first.

## Add / Update / Remove a Tool

There is **no per-tool method**. The pattern for all tool changes is:

```python
from azure.ai.projects.models import WebSearchTool, CodeInterpreterTool, MCPTool

NAME = "example-toolbox"

# 1. Read the current default version's tools
default_version = toolboxes.get(name=NAME).default_version
current = toolboxes.get_version(name=NAME, version=default_version).tools
# `current` is a list of typed tool objects

# 2. Build the new tools list (add / replace / omit entries)
new_tools = [
    WebSearchTool(name="web"),
    CodeInterpreterTool(name="code"),  # ← added
    MCPTool(server_label="github", server_url="https://api.githubcopilot.com/mcp",
            project_connection_id="github-mcp-key-conn", require_approval="never"),
]

# 3. Create a new immutable version
v2 = toolboxes.create_version(
    name=NAME, tools=new_tools, description="Added code interpreter",
)

# 4. Promote it
toolboxes.update(name=NAME, default_version=v2.version)
```

To **list current tools**, use `get_version(...).tools` (typed) or query the MCP runtime endpoint with `tools/list` — see [toolbox-reference.md](toolbox-reference.md#testing-the-toolbox-endpoint).

## Tool Constructors by Type

All from `azure.ai.projects.models`. Authenticated tools reference credentials via `project_connection_id` (the name of a project connection).

### `WebSearchTool`

Has `name`, `description`, `filters`, `search_context_size`, `user_location`, `custom_search_configuration` attributes.

```python
from azure.ai.projects.models import WebSearchTool, BingCustomSearchConfiguration

# Default Bing Grounding
tool = WebSearchTool()
tool = WebSearchTool(name="web")  # named (required for multi-tool versions)

# Custom Bing Search resource (request shape only, not e2e validated)
tool = WebSearchTool(
    name="web",
    custom_search_configuration=BingCustomSearchConfiguration(
        project_connection_id="bing-conn",
        instance_name="my-instance",
    ),
)
```

### `CodeInterpreterTool`

Has `name`, `description`, `container` attributes.

```python
from azure.ai.projects.models import CodeInterpreterTool
tool = CodeInterpreterTool(name="code")
```

### `FileSearchTool`

Has `name`, `description`, `filters`, `max_num_results`, `ranking_options`, `vector_store_ids` attributes.

```python
from azure.ai.projects.models import FileSearchTool

tool = FileSearchTool(
    name="docs",
    vector_store_ids=["vs_abc123"],
    description="Search uploaded docs",
)
```

### `MCPTool`

Has `server_label`, `server_url`, `project_connection_id`, `require_approval`, `allowed_tools`, `headers`, `authorization`, `connector_id`, `server_description` attributes. **No `name`** — `server_label` is the identifier.

```python
from azure.ai.projects.models import MCPTool

# Public, no-auth MCP (with a placeholder-keys connection)
tool = MCPTool(
    server_label="learn",
    server_url="https://learn.microsoft.com/api/mcp",
    project_connection_id="learn-mcp-conn",
    require_approval="never",
)

# GitHub MCP with a CustomKeys (PAT) connection
tool = MCPTool(
    server_label="github",
    server_url="https://api.githubcopilot.com/mcp",
    project_connection_id="github-mcp-key-conn",
    require_approval="never",
    allowed_tools=["search_repos", "get_issue"],   # optional allowlist
    headers={"X-Custom": "value"},                 # optional extra headers
)
```

### `AzureAISearchTool` ⚠️ no `name=`

Wraps a `AzureAISearchToolResource`. **Cannot have a `name`** — if you need it alongside other tools, all the others need names but this one cannot. Validator may reject multi-tool versions where this is one of multiple un-named tools.

```python
from azure.ai.projects.models import (
    AzureAISearchTool, AzureAISearchToolResource, AISearchIndexResource,
)

tool = AzureAISearchTool(
    azure_ai_search=AzureAISearchToolResource(
        indexes=[
            AISearchIndexResource(
                index_name="my-index",
                project_connection_id="search-conn",
            )
        ]
    )
)
```

### `OpenApiTool` ⚠️ no `name=`

Same caveat as `AzureAISearchTool`. The `openapi` dict carries its own `name` field for the API.

```python
from azure.ai.projects.models import (
    OpenApiTool, OpenApiAnonymousAuthDetails,
    OpenApiProjectConnectionAuthDetails, OpenApiProjectConnectionSecurityScheme,
)

# Anonymous
tool = OpenApiTool(openapi={
    "name": "my-api",
    "spec": {"openapi": "3.0.0", "info": {"title": "X", "version": "1.0.0"}, "paths": {}},
    "auth": {"type": "anonymous"},
})

# Connection-based auth (request shape only)
tool = OpenApiTool(openapi={
    "name": "my-api",
    "spec": { ... },
    "auth": OpenApiProjectConnectionAuthDetails(
        security_scheme=OpenApiProjectConnectionSecurityScheme(
            project_connection_id="api-conn",
        ),
    ),
})
```

### `A2APreviewTool` ⚠️ no `name=`

Has `base_url`, `project_connection_id`, `agent_card_path` attributes only.

> ⚠️ Specify **exactly one** of `base_url` or `project_connection_id`. Including both fails at MCP runtime with: `A2A tool config must specify exactly one of 'base_url' or 'project_connection_id', not both`. The version is created successfully but `tools/list` returns empty + the error.

```python
from azure.ai.projects.models import A2APreviewTool

# By URL (anonymous / direct)
tool = A2APreviewTool(base_url="https://example.com/agent")

# By project connection
tool = A2APreviewTool(project_connection_id="target-agent-conn")
```

## Validation Notes

Every method signature, kwarg name, version-string format, and tool constructor in this doc was executed against `azure-ai-projects==2.1.0a20260408001` and the live Foundry project `xiaofhua-toolbox-009` in May 2026. Test toolboxes (`py-tb-*`) are kept in the project as reference fixtures.

| Validation | Status |
|------------|--------|
| `client.beta.toolboxes.{create_version, list, get, update, delete, list_versions, get_version, delete_version}` | ✅ Live-validated; first kwarg is `name=`, not `toolbox_name=` |
| `WebSearchTool`, `CodeInterpreterTool`, `FileSearchTool`, `MCPTool` (default + named) | ✅ Live-validated |
| `AzureAISearchTool`, `OpenApiTool` (anon), `A2APreviewTool` | ✅ Live-validated; **no `name` kwarg** |
| `WebSearchTool` with `BingCustomSearchConfiguration` | ⚠️ Request shape only |
| `OpenApiTool` with connection auth | ⚠️ Request shape only |
| MCP `tools/list` round-trip across all 8 SDK-created reference toolboxes (`py-tb-*`) | ✅ Live-validated |
| MCP `tools/call` end-to-end: `code_interpreter` (`print("hello")`→`hello`), Learn MCP (`learn.microsoft_docs_search`), GitHub MCP (`gh.get_me` via PAT) | ✅ Live-validated |
| MCP runtime arg names (from `tools/list` schema): `web_search.search_query`, `file_search.queries[]`, `code_interpreter.code` | ✅ Live-validated |
| `A2APreviewTool` with both `base_url` and `project_connection_id` | ❌ Rejected at MCP runtime — pick one |

## Sources

- [`samples/python/toolbox/sample_toolboxes_crud.py`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/sample_toolboxes_crud.py) — note: this sample uses `toolbox_name=`, which is **incorrect for the current SDK**. Use `name=` instead.
- [`SUPPORTED_TOOLBOX_TOOLS.md`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md)
- [Toolbox docs — Python tab](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [`azure-ai-projects` on PyPI](https://pypi.org/project/azure-ai-projects/)
