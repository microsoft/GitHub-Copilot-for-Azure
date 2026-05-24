# Use Toolbox in a Hosted Agent

Hosted agents access Foundry-managed tools through a **Toolbox MCP endpoint**. Unlike prompt agents that wire tools directly, hosted agents connect to a single MCP-compatible endpoint that exposes all configured tools. The platform handles credential injection, token refresh, and policy enforcement.

> 📘 For endpoint format, MCP protocol details, auth, OAuth consent handling, testing, citation pattern, and troubleshooting, see [toolbox-reference.md](toolbox-reference.md).
>
> 📘 For wiring a remote tool (catalog tile or generic MCP server) into a project connection that a toolbox can attach to, see [foundry-tool-catalog.md](foundry-tool-catalog.md).
>
> 📘 For the full list of supported tool types and their per-type fields, see [agent-tools.md](agent-tools.md).

## ✨ Recommendation: enable Tool Search

**Before adding more than ~5 tools to a toolbox, add `{ "type": "toolbox_search_preview" }` to the toolbox.** This replaces the full `tools/list` shown to the model with two meta-tools — `tool_search` (natural-language discovery) and `call_tool` (invoke a discovered tool) — so context cost stays flat as the toolbox grows.

- The `toolbox_search_preview` entry **doesn't count** toward the unnamed-tool-per-type limit.
- All other tools in the toolbox are hidden from the initial `tools/list` and surfaced only by `tool_search` (or by per-user auto-pinning of hot tools).
- Pin specific high-traffic tools or add ranking-only keywords via `tool_configs.{tool_name}` (with `pin: true` and `additional_search_text`).
- In the agent's system prompt, instruct the model to call `tool_search` whenever a needed capability isn't already visible.

Full configuration recipe in [agent-tools.md § Tool Search](agent-tools.md#tool-search-preview) and the public [Tool Search (preview) docs](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search).

## Quick Reference

| Property | Value |
|----------|-------|
| **Toolbox Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox |
| **Tool Catalog Docs** | https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog |
| **Tool Search Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search |
| **Work IQ Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/work-iq |
| **Fabric IQ Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/fabric-iq |
| **Routines Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines |
| **Default Sample (Python)** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/maf |
| **Python Hosted Agent — `responses`** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses |
| **Python Hosted Agent — `invocations`** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations |
| **C# (.NET) Samples** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/toolbox |
| **Supported Tool Types & Auth (sample-side reference)** | https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md |

## Resolve Toolbox Endpoint

If the user provides a toolbox name or endpoint URL, or the project already references a toolbox (e.g., in `.env` or `agent.manifest.yaml`) → use it directly.

Otherwise, ask one question:

> _"Would you like to provide your toolbox endpoint? (you can create one with the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) or the [Foundry Portal](https://ai.azure.com/))"_

Once the user supplies the toolbox name/endpoint — either an existing one or a new one they create via the Foundry Toolkit or Foundry Portal — set it on the agent (e.g., `TOOLBOX_ENDPOINT` in `.env`) and continue with verification.

> Use the env var name **`TOOLBOX_ENDPOINT`** (no `FOUNDRY_` prefix). The Foundry platform reserves `FOUNDRY_`-prefixed env vars and may silently overwrite them at runtime — see [toolbox-reference.md § Agent env contract](toolbox-reference.md#agent-env-contract).

> **When asking the question, always include the doc links inline** for the manual options — the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) and the [Foundry Portal](https://ai.azure.com/) — so the user knows where to go to create a tool/toolbox themselves. Don't just name the options; render them as clickable links every time.

> **Before printing out any step-by-step guidance** for the Foundry Toolkit (VS Code) path, fetch and read [Use Tool Catalog to connect tools and Toolboxes in Foundry Toolkit](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) first, then summarize the relevant steps for them. Don't paraphrase from memory — the Toolkit UI changes; quote the current doc.

## Available tool types

The full set is documented in [agent-tools.md](agent-tools.md) and — authoritatively — in the public [Toolbox docs (Configure tools)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools). At time of writing the supported `type` values are:

| `type` | Tool | Connection required? |
|---|---|---|
| `mcp` | Remote MCP server (third-party via catalog, BYO OAuth, or generic) | Optional (none / static key / project MI / OAuth) |
| `web_search` | Web search (basic Bing; optional `web_search.custom_search_configuration` for Bing Custom Search to scope grounding to specific domains) | No (basic); Yes for Custom Search |
| `azure_ai_search` | Azure AI Search index | Yes (Search service connection) |
| `code_interpreter` | Sandboxed Python execution | No |
| `file_search` | Vector-store-backed retrieval over uploaded files | No (vector store is part of the toolbox) |
| `openapi` | REST API exposed via an OpenAPI 3.x spec | Conditional (`connection` requires `project_connection_id`; `managed_identity` does not — uses project MI + `audience`) |
| `a2a_preview` | Call another Foundry agent as a tool | Optional |
| `work_iq_preview` | Microsoft 365 work context (mail / meetings / files / chats) via Work IQ | Yes (Work IQ `RemoteA2A` OAuth connection; BYO Entra app; M365 Copilot license per user) |
| `fabric_iq_preview` | Microsoft Fabric data (Ontology / Fabric data agent / Power BI semantic model) | Yes (Fabric IQ OAuth connection; tenant admin consent) |
| `toolbox_search_preview` | **Tool Search** — a directive (not a tool) that swaps `tools/list` for `tool_search` + `call_tool` meta-tools | No |

**Adjacent (not a `type` in a toolbox version):**

- **Agent Memory** — use the `MemorySearchTool` SDK class on prompt agents; for hosted agents, configure the memory store via the project (separate from the toolbox).
- **Routines (preview)** — not a tool; an agent **trigger** (`schedule` / `timer` / `github_issue` / `custom`) that invokes an existing agent. Event-based routines are powered by the same **Connector Namespace** that backs catalog-MCP / managed-MCP connectors. See [agent-tools.md § Routines](agent-tools.md#routines-preview) and the [public Routines docs](https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines).

## Information to Gather Before Building a Toolbox Payload

When the user asks to "add an MCP tool" or similar, **never guess**. Confirm each field before generating any JSON or `azure.yaml` snippet:

| # | Question | Why needed |
|---|----------|------------|
| 1 | **MCP server URL?** | The `server_url` field on the `mcp` tool entry |
| 2 | **Auth type?** `none` / `key` / `mi` / `oauth` | Determines whether a project connection is required and which shape to create (see [foundry-tool-catalog.md](foundry-tool-catalog.md)) |
| 3 | **Project connection name** (if auth ≠ `none`) | The `project_connection_id` field; must already exist in the Foundry project |
| 4 | **`server_label`** | Short prefix for the tool names exposed by this server (e.g. `myserver`) |
| 5 | **Toolbox name** | The container that will hold the tool entries |
| 6 | **Foundry project endpoint** | Where the toolbox is created — read from `PROJECT_ENDPOINT` / `AZURE_AI_PROJECT_ENDPOINT` (avoid `FOUNDRY_`-prefixed names) |
| 7 | **Many tools planned?** (> ~5) | If yes, also add `{ "type": "toolbox_search_preview" }` so the model uses [Tool Search](#-recommendation-enable-tool-search) instead of seeing the full list. |

### Toolbox payload — MCP with a project connection

```json
{
  "name": "<TOOLBOX_NAME>",
  "description": "MCP server with key or OAuth auth",
  "tools": [
    {
      "type": "mcp",
      "server_label": "<LABEL>",
      "server_url": "<SERVER_URL>",
      "require_approval": "never",
      "project_connection_id": "<CONNECTION_NAME>"
    }
  ]
}
```

### Toolbox payload — public MCP (no auth)

```json
{
  "name": "api-specs",
  "description": "Public MCP server, no connection needed",
  "tools": [
    {
      "type": "mcp",
      "server_label": "api_specs",
      "server_url": "https://gitmcp.io/Azure/azure-rest-api-specs",
      "require_approval": "never"
    }
  ]
}
```

### Toolbox payload — large toolbox with Tool Search

```json
{
  "name": "big-toolbox",
  "description": "Many tools — model uses tool_search to discover",
  "tools": [
    { "type": "toolbox_search_preview" },
    { "type": "web_search" },
    { "type": "azure_ai_search", "name": "docs_index", "project_connection_id": "search-conn", "index_name": "docs" },
    {
      "type": "mcp", "server_label": "github", "server_url": "<github-mcp-url>",
      "project_connection_id": "gh-conn",
      "tool_configs": {
        "search_issues": { "pin": true, "additional_search_text": "GitHub issues bug tracking" },
        "*":             { "additional_search_text": "GitHub repositories code" }
      }
    }
  ]
}
```

### Declarative path via `azd`

If the project already uses `azd ai agent init`, prefer declaring the toolbox in `azure.yaml` so `azd deploy` provisions it and injects `TOOLBOX_ENDPOINT` automatically:

```yaml
# Declare secret parameters first; azd will prompt for the value on `azd up`
# (or read it from `AZURE_<NAME>` env vars) and never store it in plaintext.
params:
  - name: github_pat
    type: securestring

resources:
  - kind: connection
    name: <CONNECTION_NAME>
    target: <MCP_SERVER_URL>
    category: remoteTool
    credentials:
      type: CustomKeys
      keys:
        # Header name comes from the catalog entry's x-ms-connection-parameters.
        # {{ github_pat }} is resolved from the `params` block above.
        Authorization: "Bearer {{ github_pat }}"

  - kind: toolbox
    name: agent-tools
    tools:
      - type: toolbox_search_preview   # recommended for any toolbox > ~5 tools
      - type: web_search
      - type: mcp
        server_label: <LABEL>
        server_url: <MCP_SERVER_URL>
        project_connection_id: <CONNECTION_NAME>
```

See [azd `params` reference](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-schema#params) for the full parameter syntax.

### Imperative path via `azd ai` CLI

Use the `azd ai` command surface when you want to create or inspect connections and toolboxes ad-hoc, outside of an `azure.yaml` deployment. Every command below has been exercised end-to-end against a Foundry project.

> All commands require `--project-endpoint <PROJECT_ENDPOINT>` (the value of `PROJECT_ENDPOINT`, e.g. `https://<account>.services.ai.azure.com/api/projects/<project>`). To avoid repeating it, export it once:
>
> ```pwsh
> $PE = "https://<account>.services.ai.azure.com/api/projects/<project>"
> ```

#### 1. Create a project connection — `azd ai connection create`

Used to wire credentials for an MCP server (or other remote tool) into the project so a toolbox entry can reference it by name.

**Remote MCP server with a custom-keys header (e.g. GitHub PAT):**

```pwsh
azd ai connection create my-gh-conn `
  --project-endpoint $PE `
  --kind remote-tool `
  --target "https://api.githubcopilot.com/mcp/" `
  --auth-type CustomKeys `
  --keys "Authorization=Bearer $env:GITHUB_PAT"
```

- `--kind` value for any remote MCP / custom-headers connection is **`remote-tool`**.
- `--auth-type CustomKeys` pairs with one or more `--keys "<header>=<value>"` flags. The header name is sent verbatim on every MCP request.
- Verify after creation:
  ```pwsh
  azd ai connection show my-gh-conn --project-endpoint $PE
  ```

**Inspect existing connections:**

```pwsh
azd ai connection list --project-endpoint $PE
```

**Delete a connection:**

```pwsh
azd ai connection delete my-gh-conn --project-endpoint $PE --force --no-prompt
```

#### 2. Create a toolbox — `azd ai toolbox create --from-file`

The `--from-file` YAML schema accepts exactly two top-level fields: `description:` and `connections:`. Each connection entry references an **existing** project connection by `name` and contributes one tool to the toolbox.

```yaml
# my-toolbox.yaml
description: <human-readable description of the toolbox>
connections:
  - name: <project-connection-name>            # required — must already exist
    # index: <search-index>                    # required only for CognitiveSearch connections
    # instance_name: <bing-custom-config>      # required only for GroundingWithCustomSearch connections
```

Create the toolbox:

```pwsh
azd ai toolbox create my-toolbox `
  --project-endpoint $PE `
  --from-file .\my-toolbox.yaml `
  --no-prompt
```

**Example A — Grounding with Custom Search (ApiKey auth on the connection):**

```yaml
description: Bing Custom Search grounding
connections:
  - name: my-grounding-conn
    instance_name: agentdoc          # name of the Bing Custom Search configuration
```

**Example B — Azure AI Search index (ApiKey auth on the connection):**

```yaml
description: AI Search over the docs index
connections:
  - name: my-search-conn
    index: bbc                       # search index to query
```

**Example C — Remote MCP server (custom-keys auth on the connection):**

```yaml
description: GitHub MCP via PAT
connections:
  - name: my-gh-conn                 # the connection created in step 1
```

#### 3. Inspect toolboxes

```pwsh
# List all toolboxes in the project
azd ai toolbox list --project-endpoint $PE

# Show one toolbox (includes the computed MCP endpoint URL)
azd ai toolbox show my-toolbox --project-endpoint $PE

# List all versions of a toolbox (the default version is marked)
azd ai toolbox version list my-toolbox --project-endpoint $PE
```

#### 4. Delete a toolbox

Delete requires **both** flags — without them the CLI prompts interactively:

```pwsh
azd ai toolbox delete my-toolbox --project-endpoint $PE --force --no-prompt
```

#### 5. End-to-end smoke test

After `toolbox create`, hit the MCP endpoint directly to confirm the tool is reachable before pointing an agent at it:

```pwsh
$TOK = az account get-access-token --resource "https://ai.azure.com" --query accessToken -o tsv
$H   = @{
  Authorization      = "Bearer $TOK"
  "Content-Type"     = "application/json"
  "Foundry-Features" = "Toolboxes=V1Preview"
}
$URL = "$PE/toolboxes/my-toolbox/mcp?api-version=v1"
$body = @{ jsonrpc = "2.0"; id = 1; method = "tools/list"; params = @{} } | ConvertTo-Json
(Invoke-RestMethod -Method POST -Uri $URL -Headers $H -Body $body).result.tools | Select-Object name
```

`?api-version=v1` and the `Foundry-Features: Toolboxes=V1Preview` header are both required.

## Code Integration Patterns

The sample repo provides integration patterns for both Python and C#. Read the sample code and adapt it to the user's project.

**Python samples:**

| Sample | Framework | Protocol | When to use |
|--------|-----------|----------|-------------|
| [`toolbox/maf/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/maf) — recommended | Agent Framework (MAF) | Responses | **Default choice** |
| [`bring-your-own/responses/langgraph-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/langgraph-toolbox) | LangGraph (BYO) | Responses | LangGraph hosted agent with toolbox |
| [`toolbox/copilot-sdk/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/copilot-sdk) | GitHub Copilot SDK | Responses | Copilot SDK with toolbox tools |
| [`bring-your-own/responses/bring-your-own-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/bring-your-own-toolbox) | Generic MCP (BYO) | Responses | Raw `httpx` MCP client — works with any framework |
| [`bring-your-own/invocations/toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations/toolbox) | Generic MCP (BYO) | Invocations | Toolbox via Invocations protocol |

**C# (.NET) samples:**

| Sample | Description |
|--------|-------------|
| [`csharp/toolbox/maf/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/toolbox/maf) — recommended | Agent Framework agent with toolbox MCP (Responses protocol) |

**Notes** (apply to all patterns, both Python and C#):

- Auth: Inject a bearer token with scope `https://ai.azure.com/.default` on every request (Python: `httpx.Auth` subclass; C#: `DefaultAzureCredential` + `BearerTokenAuthenticationPolicy`).
- Header: Always include `Foundry-Features: Toolboxes=V1Preview`.
- MCP client: Pass `load_prompts=False` — the toolbox endpoint does not support `prompts/list`.
- Endpoint: Construct from `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1`.
- Multi-tool toolboxes: at most one tool per unnamed type, and unique `server_label` per MCP tool (see [toolbox-reference.md](toolbox-reference.md#multi-tool-toolbox-constraint)). `toolbox_search_preview` doesn't count toward this limit.
- Tool naming: MCP-sourced tools are prefixed `{server_label}.{tool_name}`; **all other tool types** use the entry's `name` field value (or the default tool name).

> 💡 **Tip:** If MCP tools have `require_approval: "always"` in `_meta.tool_configuration`, the agent runtime must ask the user for confirmation before invoking. The toolbox endpoint does not enforce this — your agent code is responsible.

## Tracing

All toolbox samples emit OpenTelemetry traces. No code changes are required to enable export to Azure Monitor — it's purely a configuration step.

- **Local development:** set `APPLICATIONINSIGHTS_CONNECTION_STRING` in the agent's `.env`.
- **Deployed:** the platform injects `APPLICATIONINSIGHTS_CONNECTION_STRING` automatically when the Foundry project is linked to an Application Insights resource.
- **Per-framework instrumentation hooks** (already present in the samples):
  - `maf` — `main.py` calls `enable_instrumentation()`.
  - `langgraph` / `azd` — auto-instrumented by `azure-ai-agentserver-core[tracing]`.
- **Viewing traces:** Azure Portal → Application Insights → **Investigate → Transaction search** (per-trace) or **Application map** (dependency graph).
