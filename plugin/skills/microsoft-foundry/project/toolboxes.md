# Toolbox & Tool CRUD

Standalone CRUD operations for Foundry **toolboxes** and the **tools** inside them. Use this skill when the user directly asks to create / update / delete a toolbox or a tool — outside the hosted-agent creation flow.

**Loading this skill means the user wants AI to perform the CRUD operation.** Do not ask whether they want a manual (Portal / VS Code Toolkit) path — proceed with AI-driven methods (azd, SDK, or REST). Manual paths are only offered from the hosted-agent integration flow in [use-toolbox-in-hosted-agent.md](../foundry-agent/create/references/use-toolbox-in-hosted-agent.md).

> 📘 If the user is creating a hosted agent that needs tools, use [use-toolbox-in-hosted-agent.md](../foundry-agent/create/references/use-toolbox-in-hosted-agent.md) instead — it handles the full integration flow (resolve existing toolbox → create if missing → generate agent code).
>
> 📘 For endpoint format, MCP protocol details, auth, OAuth consent, testing, and troubleshooting, see [toolbox-reference.md](../foundry-agent/create/references/toolbox-reference.md).

## Concept: Tools Live Inside a Toolbox

In Foundry hosted agents, a **tool is not a standalone resource** — every tool (Web Search, Azure AI Search, Code Interpreter, File Search, MCP Server, OpenAPI, A2A) is configured **inside a toolbox**. The toolbox is the unit the agent connects to via a single MCP endpoint.

When a user says _"create a tool"_ or _"add a web search tool"_, they likely don't know about this wrapping. Surface it briefly, then route accordingly.

## Routing

```
User intent
│
├─ "create / update / delete a toolbox"
│       └─ Toolbox CRUD (AI)
│
├─ "create / add / update / delete a tool"
│       ├─ No toolbox yet  → explain wrapping → Toolbox CRUD (create, AI) → then Tool CRUD (AI)
│       └─ Toolbox exists  → Tool CRUD (AI)
│
└─ "list toolboxes" / "list tools in toolbox X"
        └─ Read-only CRUD
```

## AI Methods

Three paths are available. **Pick one based on the operation and the user's project context — do not prompt the user to choose.**

| Method | Strengths | Limitations | Reference |
|--------|-----------|-------------|-----------|
| **azd** | Source-controlled `agent.manifest.yaml`, idempotent re-deploy, easiest first-time create | **Create + re-deploy only.** Cannot list, get, promote a default version, or delete a single toolbox (`azd down` deletes the whole project). | [crud-toolbox-azd.md](references/crud-toolbox-azd.md) |
| **Python SDK** (`azure-ai-projects`) | Full CRUD; only path with verified, documented endpoints for every operation | Requires Python; needs `--pre` install until 2.1.0 GA | [crud-toolbox-python-sdk.md](references/crud-toolbox-python-sdk.md) |
| **REST API** | Language-agnostic; good for scripting / debugging | Toolbox-level list/get/delete (not version-scoped) endpoints are inferred from convention — not in published docs | [crud-toolbox-rest.md](references/crud-toolbox-rest.md) |

### Method-selection rules

1. **First-time create + project already uses azd, or user wants infra-as-code** → azd.
2. **Any management op** (list, get, promote `default_version`, delete a toolbox or version) → Python SDK (preferred). Fall back to REST only if Python isn't available.
3. **Adding / updating / removing tools after first create** → Python SDK or REST. azd can do it via re-deploy, but cannot promote the resulting new version.
4. **Quick read-only inspection from a shell** → REST.

## Core Concepts (apply to all three paths)

- A **toolbox** is the parent object (`name`, `default_version`); it has many **immutable versions**.
- **There is no per-tool CRUD.** Tools live as a list inside a toolbox version. To add / update / remove a tool: build the new tools list → create a new version → promote it via `default_version`.
- All CRUD goes against the **data plane** (`<account>.services.ai.azure.com/api/projects/<project>/toolboxes/...`), never ARM.
- 7 supported tool types: `web_search`, `azure_ai_search`, `code_interpreter`, `file_search`, `mcp`, `openapi`, `a2a_preview`. Authenticated tools reference credentials by `project_connection_id`.

## Toolbox CRUD

| Operation | azd | Python SDK | REST |
|-----------|-----|------------|------|
| Create + first version | ✅ `azd up` (manifest) | ✅ `create_version()` | ✅ `POST /toolboxes/{n}/versions` |
| List toolboxes | ❌ | ✅ `list()` | ✅ `GET /toolboxes` |
| Get toolbox | ❌ | ✅ `get()` | ✅ `GET /toolboxes/{n}` |
| Promote `default_version` | ❌ | ✅ `update(default_version=…)` | ✅ `PATCH /toolboxes/{n}` |
| List versions | ❌ | ✅ `list_versions()` | ✅ `GET /toolboxes/{n}/versions` |
| Get version | ❌ | ✅ `get_version()` | ✅ `GET /toolboxes/{n}/versions/{v}` |
| Delete version | ❌ | ✅ `delete_version()` | ✅ `DELETE /toolboxes/{n}/versions/{v}` |
| Delete toolbox | ⚠️ only via `azd down` (whole project) | ✅ `delete()` | ✅ `DELETE /toolboxes/{n}` |

For exact syntax, manifest YAML, SDK calls, and curl bodies, follow the reference doc for the chosen method:
- [crud-toolbox-azd.md](references/crud-toolbox-azd.md)
- [crud-toolbox-python-sdk.md](references/crud-toolbox-python-sdk.md)
- [crud-toolbox-rest.md](references/crud-toolbox-rest.md)

## Tool CRUD (inside a toolbox)

Reminder: tools have no individual CRUD endpoints. Every change is a **new version** of the toolbox.

### The pattern (all three methods)

1. Determine the **current tools list** of the active version.
   - Python SDK: `client.beta.toolboxes.get_version(name, version)` (returns the version with its tools).
   - REST: `GET /toolboxes/{name}/versions/{version}?api-version=v1`.
   - Live runtime list: MCP `tools/list` against the toolbox endpoint — see [toolbox-reference.md](../foundry-agent/create/references/toolbox-reference.md#testing-the-toolbox-endpoint).
2. **Build the new tools list** — add, replace, or omit entries.
3. **Create a new version** with the new list.
4. **Promote** the new version to `default_version` (Python SDK or REST — not azd).

### Per-tool-type configuration

Each reference doc has a section per tool type with the exact YAML / Python class / JSON shape:

| Tool type | azd YAML | Python class | REST JSON |
|-----------|----------|--------------|-----------|
| `web_search` | [crud-toolbox-azd.md#web_search-bing-grounding](references/crud-toolbox-azd.md#web_search-bing-grounding) | [crud-toolbox-python-sdk.md#websearchtool](references/crud-toolbox-python-sdk.md#websearchtool) | [crud-toolbox-rest.md#web_search](references/crud-toolbox-rest.md#web_search) |
| `azure_ai_search` | [azd](references/crud-toolbox-azd.md#azure_ai_search) | [SDK](references/crud-toolbox-python-sdk.md#azureaisearchtool) | [REST](references/crud-toolbox-rest.md#azure_ai_search) |
| `code_interpreter` | [azd](references/crud-toolbox-azd.md#code_interpreter) | [SDK](references/crud-toolbox-python-sdk.md#codeinterpretertool) | [REST](references/crud-toolbox-rest.md#code_interpreter) |
| `file_search` | [azd](references/crud-toolbox-azd.md#file_search) | [SDK](references/crud-toolbox-python-sdk.md#filesearchtool) | [REST](references/crud-toolbox-rest.md#file_search) |
| `mcp` | [azd](references/crud-toolbox-azd.md#mcp-remote-mcp-server) | [SDK](references/crud-toolbox-python-sdk.md#mcptool) | [REST](references/crud-toolbox-rest.md#mcp) |
| `openapi` | [azd](references/crud-toolbox-azd.md#openapi) | [SDK](references/crud-toolbox-python-sdk.md#openapitool) | [REST](references/crud-toolbox-rest.md#openapi) |
| `a2a_preview` | [azd](references/crud-toolbox-azd.md#a2a_preview-agent-to-agent) | [SDK](references/crud-toolbox-python-sdk.md#a2apreviewtool-agent-to-agent) | [REST](references/crud-toolbox-rest.md#a2a_preview-agent-to-agent) |

### Auth / connections

For any tool that needs credentials (MCP with key/OAuth, Azure AI Search, OpenAPI with auth, custom Bing, A2A), create a **project connection** first and reference it from the tool by `project_connection_id`. Connection types: `CustomKeys`, `OAuth2` (managed connector or custom), `AgenticIdentity`, `UserEntraToken`. See [crud-toolbox-azd.md#connection-auth-types](references/crud-toolbox-azd.md#connection-auth-types) for the manifest shape and supported `authType` values.
