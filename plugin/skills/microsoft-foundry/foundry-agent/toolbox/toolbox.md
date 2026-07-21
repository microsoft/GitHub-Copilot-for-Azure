# Foundry Toolbox — Concept, API Shape & Schema

# Understand

## What a toolbox is

A **toolbox** is a managed Foundry resource: define a curated set of tools once, manage them centrally, and expose them through a **single MCP-compatible endpoint** any agent can consume. The platform handles credential injection, token refresh, and policy enforcement at runtime.

> ✅ **Recommended:** a toolbox is the **best way** to connect tools to a Foundry agent — it centralizes auth (bearer tokens, refresh, OAuth consent, per-user passthrough), enforces policy, and lets you add/remove/reconfigure tools **without changing agent code**.

- **Build** — select tools, configure auth centrally, publish a reusable toolbox.
- **Consume** — connect any MCP-compatible runtime (Microsoft Agent Framework, LangGraph, GitHub Copilot, Claude Code, Copilot Studio, custom code) to the endpoint.

For consuming a toolbox from hosted-agent code, see [use-toolbox-in-hosted-agent.md](../create/references/use-toolbox-in-hosted-agent.md).

# Build & use

## Create & use a toolbox (happy path)

> 🚦 Before creating a toolbox/connection, read the boundary rules in [create-hosted.md → Toolbox creation boundary](../create/create-hosted.md#toolbox-creation-boundary).

### Prerequisites

1. **RBAC** — the calling identity (you, and the agent identity at runtime) has **Foundry User** on the project. Grant at project scope if missing.
2. **CLI extension** — install once:

   ```bash
   azd extension install azure.ai.toolboxes
   ```

### The flow

Using the `azd ai` CLI:

1. Create the **connection** (`azd ai connection create ...`).
2. Create the **toolbox** (`azd ai toolbox create`) or add to an existing one (`azd ai toolbox connection add`).
3. If you added to an existing toolbox, **promote the new version** (`azd ai toolbox publish <name> <version>`) — `create` publishes its first version automatically; later mutations don't (see [Versions](#versions)).
4. Read the endpoint (`azd ai toolbox show <name> --output json`).
5. `azd env set TOOLBOX_ENDPOINT "<endpoint>"`.
6. Reference it in the agent service's `environmentVariables` in `azure.yaml`.
7. `azd deploy`.

Each tool type has its own end-to-end flow — pick your tool in [Supported tool types](#supported-tool-types) and follow its **Setup guide**. For the full CLI surface see [toolbox-azd.md](references/toolbox-azd.md).

## Supported tool types

The tool `type` values supported inside a toolbox version, with per-type connection requirements (auth mode is covered in each Setup guide).

| `type` | Tool | Connection required? | Setup guide |
|---|---|---|---|
| `mcp` | Remote MCP server — no auth (public) | No | [tool-mcp-noauth.md](references/tool-mcp-noauth.md) |
| `mcp` | Remote MCP server — static key (`CustomKeys`) | Yes (key connection) | [tool-mcp-key-auth.md](references/tool-mcp-key-auth.md) |
| `mcp` | Remote MCP server — OAuth, managed connector | No (Foundry handles the app; consent `-32006`) | [tool-mcp-managed-oauth.md](references/tool-mcp-managed-oauth.md) |
| `mcp` | Remote MCP server — OAuth, custom app (BYO) | Yes (your `client_id` / `client_secret`) | [tool-mcp-custom-oauth.md](references/tool-mcp-custom-oauth.md) |
| `mcp` | Remote MCP server — Entra passthrough (`UserEntraToken`) | Yes (proxies caller's identity) | [tool-mcp-entra-passthrough.md](references/tool-mcp-entra-passthrough.md) |
| `web_search` | Web search (basic Bing; `custom_search_configuration` for Bing Custom Search) | No (basic); Yes for Custom Search | [tool-web-search.md](references/tool-web-search.md) |
| `azure_ai_search` | Azure AI Search index | Yes (Search service connection) | [tool-azure-ai-search.md](references/tool-azure-ai-search.md) |
| `code_interpreter` | Sandboxed Python execution | No | [tool-code-interpreter.md](references/tool-code-interpreter.md) |
| `file_search` | Vector-store retrieval over uploaded files | No (vector store is part of the toolbox) | [tool-file-search.md](references/tool-file-search.md) |
| `openapi` | REST API via an OpenAPI 3.x spec | Conditional (`connection` needs `project_connection_id`; `managed_identity` uses project MI + `audience`) | [tool-openapi.md](references/tool-openapi.md) |
| `a2a_preview` | Call another Foundry agent as a tool | Optional | [tool-a2a.md](references/tool-a2a.md) |
| `work_iq_preview` | Microsoft 365 work context via Work IQ | Yes (BYO Entra app; M365 Copilot license) | [tool-work-iq.md](references/tool-work-iq.md) |
| `fabric_iq_preview` | Microsoft Fabric data | Yes (Fabric IQ OAuth; tenant admin consent) | [tool-fabric-iq.md](references/tool-fabric-iq.md) |
| `browser_automation_preview` | Browser automation | Yes (`PlaywrightWorkspace` connection) | [tool-browser-automation.md](references/tool-browser-automation.md) |
| `toolbox_search_preview` | **Tool Search** — a directive that swaps `tools/list` for `tool_search` + `call_tool` meta-tools | No | [tool-tool-search.md](references/tool-tool-search.md) |

**Adjacent (not a toolbox `type`):**

- **Agent Memory** — configured at the **project** level, separate from the toolbox. See [Memory docs](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/memory-usage?view=foundry).
- **Routines (preview)** — an agent **trigger** (`schedule` / `timer` / `github_issue` / `custom`), not a tool. See [Routines docs](https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines).

## Composition rules (multiple tools in one toolbox)

**At most ONE tool may be unnamed across the whole toolbox** — every other tool needs a `name` (built-ins/`openapi`) or `server_label` (`mcp`); `toolbox_search_preview` counts as a tool. See [toolbox-azd.md § Multi-tool rule](references/toolbox-azd.md#multi-tool-rule). Client-side function calling (`FunctionTool`) is not a toolbox type; declare it on the prompt agent.

### Enable Tool Search

**Before adding more than ~5 tools, add `{ "type": "toolbox_search_preview" }`.** This replaces the full `tools/list` with two meta-tools — `tool_search` and `call_tool` — so context cost stays flat. It counts as the toolbox's one allowed unnamed tool. Full behavior and flow: [tool-tool-search.md](references/tool-tool-search.md), [Tool Search docs](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search).

# Versioning, endpoints & MCP protocol

## Versions

- Versions are **immutable snapshots** — every change produces a new version.
- A toolbox has a **default version**, which controls what the consumer endpoint serves.
- The **first** version of a new toolbox is auto-promoted; later versions must be promoted explicitly.

## MCP endpoint URL format

| Role | Endpoint | Use |
|------|----------|-----|
| **Consumer** | `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1` | Connect agents. Always serves `default_version`. |
| **Developer** | `{project_endpoint}/toolboxes/{toolbox_name}/versions/{version}/mcp?api-version=v1` | Test a version before promoting. |

- `?api-version=v1` is **required** — requests without it return HTTP 400.
- Auth: bearer token with scope `https://ai.azure.com/.default`.
- Connect agents to the **consumer** endpoint so promoting a version needs no redeploy.

## MCP protocol, testing & troubleshooting

Toolboxes speak **MCP** (JSON-RPC 2.0 over HTTP POST): `tools/list`, `tools/call` (`initialize` optional). MCP-sourced tools are named `{server_label}___{tool_name}` (three underscores); `prompts/list` is not supported. Protocol details, tool naming, endpoint testing, and a create/provision troubleshooting table: [mcp-protocol.md](references/mcp-protocol.md) and [test-endpoint.md](references/test-endpoint.md).

## References

- [Toolbox (how-to)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Foundry Toolkit (VS Code)](https://code.visualstudio.com/docs/intelligentapps/tool-catalog)
- [Foundry Portal](https://ai.azure.com/)
