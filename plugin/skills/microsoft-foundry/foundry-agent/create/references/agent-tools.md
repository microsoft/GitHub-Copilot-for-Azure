# Agent Tools

This file is the **index** for every tool an agent can use. For each tool, it points to the dedicated reference, and \u2014 where the tool is also available through a [toolbox](use-toolbox-in-hosted-agent.md) \u2014 lists the toolbox `type` value.

Two delivery paths exist:

- **Prompt agent** \u2014 the agent definition declares tool classes directly (`CodeInterpreterTool`, `MCPTool`, \u2026). Use the SDK class column and the per-tool reference.
- **Hosted agent via toolbox** \u2014 the agent connects to a single MCP endpoint that exposes all tools declared in a toolbox version. Use the `type` column and see [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md). For wiring the underlying project connection (catalog tile or generic remote MCP), see [foundry-tool-catalog.md](foundry-tool-catalog.md).

## Tool Summary

| Tool | Prompt-agent SDK class | Toolbox `type` | Connection? | Reference |
|------|------------------------|----------------|-------------|-----------|
| Code Interpreter | `CodeInterpreterTool` | `code_interpreter` | No | [Code Interpreter](#code-interpreter) (this file) |
| Function calling (client-side) | `FunctionTool` | \u2014 (client-side only) | No | [Function Calling](#function-calling) (this file) |
| File Search | `FileSearchTool` | `file_search` | No (vector store required) | [tool-file-search.md](tool-file-search.md) |
| Web Search (preview) | `WebSearchPreviewTool` | `web_search` (basic) | No (basic); Yes for custom Bing | [tool-web-search.md](tool-web-search.md) |
| Bing Grounding | `BingGroundingAgentTool` | `web_search` with custom Bing connection | Yes (Bing) | [tool-bing-grounding.md](tool-bing-grounding.md) |
| Azure AI Search | `AzureAISearchAgentTool` | `azure_ai_search` | Yes (Search) | [tool-azure-ai-search.md](tool-azure-ai-search.md) |
| MCP server (remote) | `MCPTool` | `mcp` | Optional (none / key / OAuth / MI) | [tool-mcp.md](tool-mcp.md); toolbox attach via [foundry-tool-catalog.md](foundry-tool-catalog.md) |
| OpenAPI tool | (n/a as a single class) | `openapi` | Optional (none / key / OAuth) | [OpenAPI](#openapi-tool) (this file) |
| Agent-to-Agent (A2A) | (n/a as a single class) | `a2a_preview` | Optional | [A2A (preview)](#agent-to-agent-a2a-preview) (this file) |
| Agent Memory | `MemorySearchTool` | \u2014 (separate memory store) | Yes (project MI + embedding model) | [tool-memory.md](tool-memory.md) |

> \u26a0\ufe0f **Default for web search:** Use `WebSearchPreviewTool` unless the user explicitly requests Bing Grounding or Bing Custom Search.

> Combine multiple tools on one agent or one toolbox version. The model decides which to invoke. For multi-tool toolbox limits (at most one unnamed tool per type, unique `server_label` per MCP tool) see [toolbox-reference.md](toolbox-reference.md#multi-tool-toolbox-constraint).

## Code Interpreter

Enables agents to write and run Python in a sandboxed environment. Supports data analysis, chart generation, and file processing. Has [additional charges](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/) beyond token-based fees.

> Sessions: 1-hour active / 30-min idle timeout. Each conversation = separate billable session.

Toolbox shape: `{"type": "code_interpreter"}` \u2014 no other fields. Only one `code_interpreter` per toolbox version (unnamed tool).

For code samples, see: [Code Interpreter tool documentation](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/tools/code-interpreter?view=foundry)

## Function Calling

Define custom functions the agent can invoke. Your app executes the function and returns results. Runs expire 10 minutes after creation \u2014 return tool outputs promptly.

> **Security:** Treat tool arguments as untrusted input. Don't pass secrets in tool output. Use `strict=True` for schema validation.

> **Not available via toolbox** \u2014 function calling executes in the client process, so it is declared on the prompt agent, not in a toolbox version.

For code samples, see: [Function Calling tool documentation](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/tools/function-calling?view=foundry)

## OpenAPI Tool

Expose a REST API to the agent by attaching its OpenAPI 3.x spec. The platform parses the spec and synthesizes one tool per operation.

Toolbox shape:

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

- `anonymous` \u2014 no credentials sent.
- `connection` with `project_connection_id` \u2014 the platform attaches keys/OAuth from the named project connection.

Multiple `openapi` entries are allowed in one toolbox **only if** each entry's spec defines a distinct `info.title` (the title is the implicit identifier).

For code samples, see: [OpenAPI tool documentation](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/tools/openapi-spec?view=foundry)

## Agent-to-Agent (A2A, preview)

Call another Foundry agent as if it were a tool. Useful for composing specialist agents into an orchestrator.

Toolbox shape:

```json
{
  "type": "a2a_preview",
  "base_url": "https://<agent-host>/agents/<agent-id>",
  "project_connection_id": "<connection_to_target_project>"
}
```

Auth is either anonymous (for the same project) or via a project connection that holds credentials for the remote agent's host.

For details, see [Tool Catalog \u2192 Agent-to-Agent](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/tool-catalog?view=foundry).

## References

- [Tool Catalog](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/tool-catalog?view=foundry)
- [Code Interpreter](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/tools/code-interpreter?view=foundry)
- [Function Calling](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/tools/function-calling?view=foundry)
- [OpenAPI tool](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/tools/openapi-spec?view=foundry)
- [Toolbox (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md) \u2014 wiring a toolbox into a hosted agent
- [foundry-tool-catalog.md](foundry-tool-catalog.md) \u2014 project connections for remote tools
