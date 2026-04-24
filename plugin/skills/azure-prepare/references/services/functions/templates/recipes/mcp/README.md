# MCP (Model Context Protocol) Recipe

MCP tool endpoints for AI agent integration via JSON-RPC 2.0 over HTTP.

## Template Selection

Resource filter: `mcp`  
Discover templates via MCP or CDN manifest where `resource == "mcp"` and `language` matches user request.

## Protocol

MCP uses **JSON-RPC 2.0** over HTTP with SSE for streaming:

- `POST /mcp` — tool invocation endpoint
- Tools registered via `@app.mcp_tool()` decorator (Python) or equivalent
- Returns structured JSON responses for AI agent consumption

See [MCP Specification](https://modelcontextprotocol.io/) for protocol details.

## Troubleshooting

### Transport Mismatch (SSE vs Streamable HTTP)

**Cause:** Client and server using different transports — SSE client gets `404`/`405`, HTTP client gets unexpected `text/event-stream`.  
**Solution:** Ensure client transport matches server. Most modern MCP SDKs default to Streamable HTTP; older examples use SSE. In VS Code `mcp.json`, set `"type": "sse"` or `"type": "http"` accordingly.

### Missing App Settings After Deploy

**Cause:** Required app settings not configured on the function app.  
**Solution:** Ensure protected resource metadata settings are present. For C# self-hosted servers, verify `host.json` `arguments` points to the compiled DLL path.

See [MCP extension trigger and bindings](https://learn.microsoft.com/azure/azure-functions/functions-bindings-mcp) for extension-based servers, [Self-hosted MCP servers](https://learn.microsoft.com/en-us/azure/azure-functions/self-hosted-mcp-servers) for self-hosted architecture, and [MCP tutorial troubleshooting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-mcp-tutorial?tabs=self-hosted#troubleshooting) for self-hosted deployment issues.

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
