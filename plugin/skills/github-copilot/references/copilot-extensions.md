# Copilot Extensions Reference

Webhook agents for GitHub Copilot Chat.

## Documentation

| Resource | URL |
|----------|-----|
| Building Copilot Extensions | https://docs.github.com/en/copilot/building-copilot-extensions |
| Building Your First Extension | https://resources.github.com/learn/pathways/copilot/extensions/building-your-first-extension/ |
| JavaScript SDK | https://github.com/copilot-extensions/preview-sdk.js |
| Example: Hello World (JS) | https://github.com/copilot-extensions/blackbeard-extension |
| Example: RAG (Go) | https://github.com/copilot-extensions/rag-extension |
| Example: Function Calling (Go) | https://github.com/copilot-extensions/function-calling-extension |
| Example: GitHub Models (TS) | https://github.com/copilot-extensions/github-models-extension |
| Example: Skillset (Go) | https://github.com/copilot-extensions/skillset-example |
| Debug CLI | https://github.com/copilot-extensions/gh-debug-cli |

Extensions are webhook endpoints that receive and respond with SSE — they can be built in any language. The JS SDK provides helpers but is not required.

> 💡 **Tip:** Use `microsoft_docs_search` (microsoft-learn MCP) to search official Microsoft docs for additional Copilot Extensions guidance.

## Getting Current Examples

1. Identify the user's preferred language and the SDK or library they need
2. Use `context7-resolve-library-id` to find the relevant library (e.g., `@copilot-extensions/preview-sdk`)
3. Use `context7-query-docs` with the resolved library ID to get current code examples and API usage
4. **Fallback:** If context7 lacks coverage, use `github-mcp-server-get_file_contents` to browse the example repos listed above
5. Read the official docs at docs.github.com for architecture and configuration guidance

## Key Concepts

| Concept | Description |
|---------|-------------|
| Acknowledge | First SSE event sent to confirm receipt |
| Text streaming | Stream content as SSE text events |
| Done signal | Final SSE event to signal completion |
| Confirmation | Prompt user for confirmation |
| References | Attach file references to response |

## Request Verification

Every request must be verified using the webhook signature. Required headers: `github-public-key-signature`, `github-public-key-identifier`. Reject unverified requests with 401.

## Testing

Use **playwright** MCP tools (`browser_navigate`, `browser_snapshot`, `browser_click`, etc.) to automate browser-based testing of the SSE endpoint. For manual verification, serve a static HTML test page and POST to the agent endpoint.

## Hosting

Extensions apps need **azure-prepare** to scaffold infra. Key requirements:
- Public HTTPS endpoint
- SSE-compatible hosting (Container Apps or App Service with `webSocketsEnabled`)
- GITHUB_TOKEN via Key Vault

## Errors

| Error | Fix |
|-------|-----|
| SSE responses truncated | Disable response buffering via headers |
| 401 on agent endpoint | Check GITHUB_TOKEN and key identifier header |
| Signature verification fails | Ensure correct public-key-signature header is used |
