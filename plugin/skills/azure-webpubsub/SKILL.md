---
name: azure-webpubsub
description: "Choose runtime/path for Web PubSub. WHEN: Web PubSub, upstream, negotiate, Socket.IO, realtime, streaming."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Web PubSub

## Quick Reference

| Best For | Tools |
|----------|-------|
| Runtime, event path, and `/negotiate` | `mcp_azure_mcp_documentation`, `mcp_azure_mcp_monitor`, `mcp_azure_mcp_resourcehealth` |

## When to Use This Skill

- Add Azure Web PubSub to an app
- Replace polling, SSE, or custom WebSockets with Web PubSub Service
- Implement real-time features like chat, live updates, or gaming with Web PubSub
- Choose between `@azure/web-pubsub-client`, `WebPubSubServiceClient`, `upstream`, or Socket.IO
- Review `/negotiate` or reconnect behavior in a Web PubSub app

## MCP Tools

| Tool | Use |
|------|-----|
| `mcp_azure_mcp_documentation` | Product/runtime guidance |

## Workflow

1. Existing app or transport swap -> [Existing App Integration](references/existing-app-integration.md).
2. Runtime: [PubSub Client SDK](references/pubsub-client-sdk.md) for browser/client; [Web PubSub for Socket.IO](references/webpubsub-for-socketio.md) for Socket.IO.
3. Choose the server role with [Server Role Decision](references/server-role-decision.md): `@azure/web-pubsub-client` = client/group pubsub; `WebPubSubServiceClient` = publish/manage; `upstream` = one server handler per event.
4. `/negotiate`, identity, roles, or reconnect -> [Negotiate Checklist](references/negotiate-checklist.md). `/negotiate` is a server-owned auth boundary.
5. Browser group/reconnect edge cases -> [Common Pitfalls](references/common-pitfalls.md).

## Error Handling

| Error | Remediation |
|------|-------------|
| Socket.IO and native APIs are mixed | Pick one runtime |
| Browser owns `userId`, tokens, or broad roles | Move tokens and roles behind `/negotiate` |
| One server handler is required | Choose `upstream` in [Server Role Decision](references/server-role-decision.md) |
