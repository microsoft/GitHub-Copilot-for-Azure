# Agent Tools

This file is the **index** for every tool an agent can use. For each tool, it points to the dedicated reference, and — where the tool is also available through a [toolbox](use-toolbox-in-hosted-agent.md) — lists the toolbox `type` value.

Two delivery paths exist:

- **Prompt agent** — the agent definition declares tool classes directly (`CodeInterpreterTool`, `MCPTool`, …). Use the SDK class column and the per-tool reference.
- **Hosted agent via toolbox** — the agent connects to a single MCP endpoint that exposes all tools declared in a toolbox version. Use the `type` column and see [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md). For wiring the underlying project connection (catalog tile or generic remote MCP), see [foundry-tool-catalog.md](foundry-tool-catalog.md).

## Tool Summary

| Tool | Prompt-agent SDK class | Toolbox `type` | Connection? | Reference |
|------|------------------------|----------------|-------------|-----------|
| Code Interpreter | `CodeInterpreterTool` | `code_interpreter` | No | [Code Interpreter](#code-interpreter) (this file) |
| Function calling (client-side) | `FunctionTool` | — (client-side only) | No | [Function Calling](#function-calling) (this file) |
| File Search | `FileSearchTool` | `file_search` | No (vector store required) | [tool-file-search.md](tool-file-search.md) |
| Web Search (preview) | `WebSearchPreviewTool` | `web_search` (with optional `web_search.custom_search_configuration` for Bing Custom Search) | No (basic Bing); **Yes** for Grounding with Bing Custom Search — the connection scopes grounding to specific domains | [tool-web-search.md](tool-web-search.md) |
| Bing Grounding | `BingGroundingAgentTool` | — (N/A in toolbox; the toolbox path uses `web_search` with `web_search.custom_search_configuration`) | Yes (Bing) — prompt-agent path only | [tool-bing-grounding.md](tool-bing-grounding.md) |
| Azure AI Search | `AzureAISearchAgentTool` | `azure_ai_search` | Yes (Search) | [tool-azure-ai-search.md](tool-azure-ai-search.md) |
| MCP server (remote) | `MCPTool` | `mcp` | Optional (none / static key / project MI / OAuth) | [tool-mcp.md](tool-mcp.md); toolbox attach via [foundry-tool-catalog.md](foundry-tool-catalog.md) |
| OpenAPI tool | (n/a as a single class) | `openapi` | Conditional — `connection` auth requires `project_connection_id`; **`managed_identity` auth does NOT** (the project MI is used directly with an `audience`) | [OpenAPI](#openapi-tool) (this file) |
| Agent-to-Agent (A2A) | (n/a as a single class) | `a2a_preview` | Optional | [A2A (preview)](#agent-to-agent-a2a-preview) (this file) |
| Agent Memory | `MemorySearchTool` | — (separate memory store) | Yes (project MI + embedding model) | [tool-memory.md](tool-memory.md) |
| **Work IQ (preview)** | (n/a — server-side only) | `work_iq_preview` | Yes (Work IQ BYO-Entra-app OAuth connection) | [Work IQ](#work-iq-preview) (this file) |
| **Fabric IQ (preview)** | (n/a — server-side only) | `fabric_iq_preview` | Yes (Fabric IQ Entra-app OAuth or managed-OAuth connection) | [Fabric IQ](#fabric-iq-preview) (this file) |
| **Tool Search (preview)** | (n/a — toolbox-side configuration directive) | `toolbox_search_preview` | No | [Tool Search](#tool-search-preview) (this file) |

> ⚠️ **Default for web search:** Use `WebSearchPreviewTool` (`type: web_search`) unless the user explicitly requests Bing Grounding or Bing Custom Search.

> Combine multiple tools on one agent or one toolbox version. The model decides which to invoke. For multi-tool toolbox limits (at most one unnamed tool per type, unique `server_label` per MCP tool) see [toolbox-reference.md](toolbox-reference.md#multi-tool-toolbox-constraint).

## Code Interpreter

Enables agents to write and run Python in a sandboxed environment. Supports data analysis, chart generation, and file processing. Has [additional charges](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/) beyond token-based fees.

> Sessions: 1-hour active / 30-min idle timeout. Each conversation = separate billable session.

> ⚠️ When Code Interpreter is used through a toolbox in a **hosted agent**, user isolation isn't supported — all users in the same project share one container context.

Toolbox shape: `{"type": "code_interpreter"}` — no other fields. Only one `code_interpreter` per toolbox version (unnamed tool).

For code samples, see: [Code Interpreter tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/code-interpreter).

## Function Calling

Define custom functions the agent can invoke. Your app executes the function and returns results. Runs expire 10 minutes after creation — return tool outputs promptly.

> **Security:** Treat tool arguments as untrusted input. Don't pass secrets in tool output. Use `strict=True` for schema validation.

> **Not available via toolbox** — function calling executes in the client process, so it's declared on the prompt agent, not in a toolbox version.

For code samples, see: [Function Calling tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/function-calling).

## OpenAPI Tool

Expose a REST API to the agent by attaching its OpenAPI 3.x spec. The platform parses the spec and synthesizes one tool per operation.

Toolbox shape (anonymous):

```json
{
  "type": "openapi",
  "openapi": {
    "spec": { /* inlined OpenAPI 3.x document */ },
    "auth": { "type": "anonymous" }
  }
}
```

`auth.type` values:

- **`anonymous`** — no credentials sent.
- **`connection`** with `project_connection_id` — Foundry attaches a static API key (or OAuth tokens) from the named project connection. **`project_connection_id` is required only here.**
- **`managed_identity`** with `audience` — the project's managed identity calls the target API. **No `project_connection_id` is required**; Foundry uses the project MI and acquires a token for the supplied `audience` (the target service's resource URI). You must grant the project MI the appropriate RBAC role on the target service or the agent receives `401 Unauthorized`.

Multiple `openapi` entries are allowed in one toolbox **only if** each entry's spec defines a distinct `info.title` (the title is the implicit identifier).

For code samples, see: [OpenAPI tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/openapi).

## Agent-to-Agent (A2A, preview)

Call another Foundry agent as if it were a tool. Useful for composing specialist agents into an orchestrator.

Toolbox shape:

```json
{
  "type": "a2a_preview",
  "name": "<AGENT_NAME>",
  "description": "<what this agent does>",
  "base_url": "<AGENT_BASE_URL>",
  "project_connection_id": "<connection_to_target_project>"
}
```

Auth is either anonymous (for the same project) or via a project connection that holds credentials for the remote agent's host.

For details, see [A2A tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/agent-to-agent).

## Work IQ (preview)

Connect an agent to the user's Microsoft 365 work context — email, meetings, files, chats — through **Work IQ**. Work IQ runs as an A2A peer; every request runs in the context of the signed-in user and honors all Microsoft 365 permissions and sensitivity labels.

Toolbox shape:

```json
{
  "type": "work_iq_preview",
  "project_connection_id": "<workiq-connection-name>"
}
```

Requirements:

- A `RemoteA2A` project connection targeting `https://workiq.svc.cloud.microsoft/a2a/`, `authType=OAuth2`, **BYO Entra app only** (no managed OAuth).
- Scopes: `api://workiq.svc.cloud.microsoft/WorkIQAgent.Ask` + `offline_access`. A **Global Administrator** must grant tenant-wide admin consent for `WorkIQAgent.Ask` (Work IQ app ID `fdcc1f02-fc51-4226-8753-f668596af7f7`).
- Each calling end-user must hold a **Microsoft 365 Copilot license**.
- The Work IQ service principal must be pre-provisioned in the tenant (one-time, via Graph Explorer); see the public doc.
- VNet integration is **not** supported — the Foundry project must not use a VNet-restricted endpoint.

For the full Entra app setup, ARM connection-creation payload (`category: RemoteA2A`), and troubleshooting, see [Work IQ tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/work-iq).

## Fabric IQ (preview)

Connect an agent to Microsoft Fabric data — Ontology, Fabric data agents, and Power BI semantic models — through **Fabric IQ**. The agent delegates natural-language questions; Fabric IQ runs them against the enterprise ontology (NL2Ontology) and returns synthesized answers under the signed-in user's Fabric permissions.

Toolbox shape:

```json
{
  "type": "fabric_iq_preview",
  "project_connection_id": "<fabriciq-connection-name>",
  "server_label": "<short-lowercase-label>",
  "server_url": "https://<host>/v1/mcp/..."
}
```

`server_url` varies by Fabric item type:

| Fabric item | `server_url` pattern | Supported auth |
|---|---|---|
| Ontology | `https://{host}/v1/mcp/dataPlane/workspaces/{workspaceId}/items/{itemId}/ontologyEndpoint` | BYO Entra app only |
| Fabric data agent | `https://{host}/v1/mcp/workspaces/{workspaceId}/dataagents/{dataAgentId}/agent` | BYO Entra app *or* managed OAuth |
| Power BI semantic model | `https://{host}/v1/mcp/fabricaihub/integrations/m365` | BYO Entra app *or* managed OAuth |

Requirements:

- Microsoft Fabric license for both the developer and every calling end-user.
- For Ontology / Power BI: Entra app with delegated Power BI permissions `Item.Execute.All` + `Item.Read.All`; tenant admin consent required. For Data Agent: `DataAgent.Execute.All`.
- Each Fabric item must be **published** before it can be consumed through Fabric IQ.
- VNet integration is **not** supported.
- Tip: for Power BI semantic models, use latest models — measure/hierarchy reasoning benefits significantly.

For the full Entra app setup, connection-creation walkthrough, and troubleshooting, see [Fabric IQ tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/fabric-iq).

## Tool Search (preview)

For toolboxes containing many tools, replace the full tool list passed to the model with two meta-tools — `tool_search` (natural-language discovery, returns matching tools per query) and `call_tool` (invoke any discovered tool by name) — so context cost stays flat regardless of toolbox size.

Toolbox shape:

```json
{ "type": "toolbox_search_preview" }
```

Behavior:

- `toolbox_search_preview` is a **configuration directive** — it doesn't appear in `tools/list` itself and doesn't count toward the unnamed-tool-per-type limit.
- All other toolbox tools are **hidden** from the initial `tools/list` and are returned only by `tool_search` calls (or by per-user auto-pinning of hot tools).
- Pin specific tools or add search-only keywords via `tool_configs.{tool_name}`:

  ```json
  {
    "type": "mcp",
    "server_label": "analytics",
    "server_url": "https://db-mcp.internal/sse",
    "tool_configs": {
      "execute_query": { "pin": true, "additional_search_text": "SQL analytics reporting dashboard" },
      "*":             { "additional_search_text": "data warehouse queries" }
    }
  }
  ```

  Use `"*"` as the key to apply settings to all tools in that entry.
- `additional_search_text` is used only for search ranking — it's never exposed to the model in the tool schema.
- Tool **descriptions drive match quality**: every MCP tool should have a clear `description`, or `tool_search` won't find it.
- Recommendation: add an instruction in the system prompt telling the model to call `tool_search` when a needed capability isn't in its current tool list.

For full fields, pinning recipes, the verify-with-`tool_search` flow, and best practices, see [Tool Search tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search).

## References

- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Toolbox (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [Tool Search (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search)
- [Work IQ (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/work-iq)
- [Fabric IQ (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/fabric-iq)
- [Code Interpreter](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/code-interpreter)
- [Function Calling](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/function-calling)
- [OpenAPI tool](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/openapi)
- [Agent-to-Agent (A2A)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/agent-to-agent)
- [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md) — wiring a toolbox into a hosted agent
- [foundry-tool-catalog.md](foundry-tool-catalog.md) — project connections for remote tools
