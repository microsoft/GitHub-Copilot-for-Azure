# Foundry Toolbox — Concept, API Shape & Schema

# Understand

## What a toolbox is

A **toolbox** is a managed Foundry resource: define a curated set of tools once, manage them centrally, and expose them through a **single MCP-compatible endpoint** that any agent can consume. The platform handles credential injection, token refresh, and enterprise policy enforcement at runtime.

> ✅ **Recommended:** A toolbox is the **best way** to connect tools to a Foundry agent — it centralizes auth (bearer-token acquisition, refresh, OAuth consent, per-user passthrough), enforces policy, and lets you add/remove/reconfigure tools **without changing agent code**. Prefer it over direct per-tool wiring in all new agents.

- **Build** — select tools, configure authentication centrally, publish a reusable toolbox.
- **Consume** — connect any MCP-compatible runtime (Microsoft Agent Framework, LangGraph, GitHub Copilot, Claude Code, Copilot Studio, custom code) to the endpoint to discover and invoke all tools.

For consuming a toolbox from hosted-agent code, see [use-toolbox-in-hosted-agent.md](../create/references/use-toolbox-in-hosted-agent.md). For creating/managing toolboxes with `azd ai`, see [Create & use a toolbox (happy path)](#create--use-a-toolbox-happy-path) below.

# Build & use

## Create & use a toolbox (happy path)

> 🚦 Before creating a toolbox/connection, read the boundary rules in [create-hosted.md → Toolbox creation boundary](../create/create-hosted.md#toolbox-creation-boundary).

### Prerequisites

Before creating anything, confirm:

1. **RBAC** — the calling identity (you as developer, and the agent identity at runtime) has **Foundry User** on the Foundry project. Grant it at project scope if missing.
2. **CLI extension** — install the toolbox extension once:

   ```bash
   azd extension install azure.ai.toolboxes
   ```

### The flow

The flow, using the `azd ai` CLI:

1. Create the **connection** (`azd ai connection create ...`).
2. Create the **toolbox** (`azd ai toolbox create`) or add tools to an existing one (`azd ai toolbox connection add`).
3. If you added to an existing toolbox, **promote the new version** (`azd ai toolbox publish <name> <version>`) — `create` publishes its first version automatically, but later mutations do not (see [Versions](#versions)).
4. Read the endpoint (`azd ai toolbox show <name> --output json`).
5. `azd env set TOOLBOX_ENDPOINT "<endpoint>"`.
6. Reference it in the agent service's `environmentVariables` in `azure.yaml`.
7. `azd deploy`.

Each tool type has its own end-to-end flow (connection command, attach, `--from-file` entry) — pick your tool in the [Supported tool types](#supported-tool-types) table and follow its **Setup guide** reference. For the full `azd ai toolbox` CLI surface see [toolbox-azd.md](references/toolbox-azd.md).

## Supported tool types

The tool `type` values supported inside a toolbox version, with per-type connection requirements.

| `type` | Tool | Auth mode | Connection required? | Setup guide |
|---|---|---|---|---|
| `mcp` | Remote MCP server — no auth (public) | None | No | [tool-mcp-noauth.md](references/tool-mcp-noauth.md) |
| `mcp` | Remote MCP server — static key | `CustomKeys` | Yes (key connection; e.g. `github_pat` as Bearer) | [tool-mcp-key-auth.md](references/tool-mcp-key-auth.md) |
| `mcp` | Remote MCP server — OAuth (managed connector) | `OAuth2` (Foundry-managed) | No (Foundry handles the app registration; consent flow, MCP code `-32006`) | [tool-mcp-managed-oauth.md](references/tool-mcp-managed-oauth.md) |
| `mcp` | Remote MCP server — OAuth (custom app) | `OAuth2` (BYO) | Yes (your `client_id` / `client_secret`) | [tool-mcp-custom-oauth.md](references/tool-mcp-custom-oauth.md) |
| `mcp` | Remote MCP server — Entra passthrough | `UserEntraToken` | Yes (proxies the caller's Entra identity) | [tool-mcp-entra-passthrough.md](references/tool-mcp-entra-passthrough.md) |
| `web_search` | Web search (basic Bing; optional `web_search.custom_search_configuration` for Bing Custom Search to scope grounding to specific domains) | — | No (basic); Yes for Custom Search | [tool-web-search.md](references/tool-web-search.md) |
| `azure_ai_search` | Azure AI Search index | `ApiKey` | Yes (Search service connection) | [tool-azure-ai-search.md](references/tool-azure-ai-search.md) |
| `code_interpreter` | Sandboxed Python execution | — | No | [tool-code-interpreter.md](references/tool-code-interpreter.md) |
| `file_search` | Vector-store-backed retrieval over uploaded files | — | No (vector store is part of the toolbox) | [tool-file-search.md](references/tool-file-search.md) |
| `openapi` | REST API exposed via an OpenAPI 3.x spec | `connection` or `managed_identity` | Conditional (`connection` requires `project_connection_id`; `managed_identity` does not — uses project MI + `audience`) | [tool-openapi.md](references/tool-openapi.md) |
| `a2a_preview` | Call another Foundry agent as a tool | `RemoteA2A` / `None` | Optional | [tool-a2a.md](references/tool-a2a.md) |
| `mcp` | Work IQ MCP server — Microsoft 365 work context (mail / meetings / files / chats) via Work IQ | `UserEntraToken` or `OAuth2` | Yes (RemoteTool connection; per-user identity) | [tool-work-iq.md](references/tool-work-iq.md) |
| `fabric_iq_preview` | Microsoft Fabric data (Ontology / Fabric data agent / Power BI semantic model) | OAuth | Yes (Fabric IQ OAuth connection; tenant admin consent) | [tool-fabric-iq.md](references/tool-fabric-iq.md) |
| `browser_automation_preview` | Browser automation | `ProjectManagedIdentity` | Yes (`PlaywrightWorkspace` connection; requires an Azure Playwright workspace) | [tool-browser-automation.md](references/tool-browser-automation.md) |
| `toolbox_search_preview` | **Tool Search** — a directive (not a tool) that swaps `tools/list` for `tool_search` + `call_tool` meta-tools | — | No | [tool-tool-search.md](references/tool-tool-search.md) |

**Adjacent (not a `type` in a toolbox version):**

- **Agent Memory** — for hosted agents, configure the memory store at the **project** level (separate from the toolbox); it is not a toolbox `type` and is not wired through agent code. See the public [Memory docs](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/memory-usage?view=foundry).
- **Routines (preview)** — not a tool; an agent **trigger** (`schedule` / `timer` / `github_issue` / `custom`) that invokes an existing agent. See the [public Routines docs](https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines).

## Composition rules (multiple tools in one toolbox)

**At most ONE tool may be unnamed across the whole toolbox** — every other tool needs a `name` (built-ins/`openapi`) or `server_label` (`mcp`), and `toolbox_search_preview` counts as a tool. See [toolbox-azd.md § Multi-tool rule](references/toolbox-azd.md#multi-tool-rule) for valid combinations and the exact `400` error.

Client-side function calling (`FunctionTool`) is **not** a toolbox type; it's declared on the prompt agent directly.

### Enable Tool Search

**Before adding more than ~5 tools to a toolbox, add `{ "type": "toolbox_search_preview" }`.** This replaces the full `tools/list` shown to the model with two meta-tools — `tool_search` (natural-language discovery) and `call_tool` (invoke a discovered tool) — so context cost stays flat as the toolbox grows. It counts as the toolbox's one allowed unnamed tool (name every other tool).

Full behavior (hidden tools, pinning via `tool_configs`, ranking keywords, system-prompt guidance) and the create/deploy flow: [tool-tool-search.md](references/tool-tool-search.md). Public [Tool Search (preview) docs](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search).

# Versioning, endpoints & MCP protocol

## Versions

- Versions are **immutable snapshots** — every change to a toolbox produces a new version.
- A toolbox has a **default version**, which controls what the consumer MCP endpoint serves.
- Creating a version does **not** auto-promote it. The **first** version of a new toolbox is auto-promoted to the default; later versions must be promoted explicitly.

## MCP endpoint URL format

| Role | Endpoint | Use |
|------|----------|-----|
| **Consumer** | `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1` | Connect agents. Always serves `default_version`. |
| **Developer** | `{project_endpoint}/toolboxes/{toolbox_name}/versions/{version}/mcp?api-version=v1` | Test a specific version before promoting. |

- `?api-version=v1` is **required** — requests without it return HTTP 400.
- Auth: bearer token with scope `https://ai.azure.com/.default`.
- Connect agents to the **consumer** endpoint so promoting a new version needs no code change or redeploy.

## MCP protocol

Toolboxes use **Model Context Protocol (MCP)** — JSON-RPC 2.0 over HTTP POST:

- **`initialize`** — Optional MCP handshake. `tools/list` / `tools/call` work without it. If you do call `initialize` and the server returns an `mcp-session-id` header, resend it on subsequent calls; if it doesn't, no session header is needed.
- **`tools/list`** — Returns all available tools with names, descriptions, and input schemas.
- **`tools/call`** — Invokes a tool with arguments and returns structured results. Plain (non-streaming) POST works; SSE streaming is optional.

> `prompts/list` is **not supported** by the toolbox endpoint. If your MCP client library calls it automatically (e.g. MAF's `MCPStreamableHTTPTool`), pass `load_prompts=False` to suppress it. A raw JSON-RPC client that never calls `prompts/list` needs no flag.

## Tool naming

- **MCP-sourced tools** (`type: mcp`) are exposed as `{server_label}___{tool_name}` — joined by **three underscores** (e.g. `myserver___get_info`). Call them with the prefixed name in `tools/call`.
- **All other tool types** use the value of the entry's `name` field, or the default tool name if `name` is unset.
- **Tool Search** injects two platform meta-tools whose names are always `tool_search` and `call_tool`.

Each tool returned by `tools/list` includes a `_meta.tool_configuration` block with at least the `type`, plus type-specific fields (e.g. `server_label`, `server_url`, `require_approval` for MCP).

## Testing the toolbox endpoint

Before running the full agent, verify the MCP endpoint end-to-end with a bearer token + raw `tools/list` / `tools/call` curl calls — see [test-endpoint.md](references/test-endpoint.md).

## Troubleshooting (create / provision)

| Symptom | Likely cause |
|---------|--------------|
| `TOOLBOX_ENDPOINT` not set | Run `azd ai toolbox show` + `azd env set`. |
| Env var missing in deployed agent | Add to the agent service's `environmentVariables` in `azure.yaml`, `azd deploy`. |
| `403 Forbidden` (incl. `POST /toolboxes`, `PUT .../connections/...`) | Caller lacks `Foundry User` (or `Azure AI Developer` / `Cognitive Services Contributor`) on the project — grant it at project scope. |
| 400 `invalid_payload: Multiple tools without identifiers found` | Two unnamed tools (or duplicate `server_label`) in one toolbox — keep **at most one unnamed tool across the entire toolbox**; give each other tool a `name` / `server_label`. See [toolbox-azd.md § Multi-tool rule](references/toolbox-azd.md#multi-tool-rule). |
| `tools/list` returns zero | Toolbox version still provisioning, or tool type not available in the region — wait ~10s and retry, or try a different region. |
| `tools/list` returns zero for MCP/A2A only | Invalid or missing connection credentials — verify `project_connection_id` exists and creds are correct; for MI auth, check RBAC on the target service. |
| `tools/list` returns zero for OpenAPI only | Invalid OpenAPI spec (malformed paths, missing operationIds) — validate against OpenAPI 3.0/3.1; for MI auth, also verify RBAC. |

For runtime/MCP-client errors (token scope, `prompts/list`, `require_approval`, tool-name prefixes), see [use-toolbox-in-hosted-agent.md § Troubleshooting](../create/references/use-toolbox-in-hosted-agent.md#troubleshooting).

## References

- [Toolbox (how-to)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [Toolbox (Configure tools)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools)
- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Foundry Toolkit (VS Code) — set up tools/toolboxes](https://code.visualstudio.com/docs/intelligentapps/tool-catalog)
- [Foundry Portal](https://ai.azure.com/)
