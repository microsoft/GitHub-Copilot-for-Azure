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

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
