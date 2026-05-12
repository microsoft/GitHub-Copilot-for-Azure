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

| Property | Value |
|----------|-------|
| **Service** | Azure Web PubSub |
| **Best For** | Realtime fan-out, WebSocket replacement, client runtime selection, upstream event handling, Socket.IO on Azure Web PubSub |
| **MCP Tools** | `mcp_azure_mcp_documentation` |
| **CLI** | `az extension add --name webpubsub --upgrade`; `az webpubsub` |
| **Primary SDKs** | `@azure/web-pubsub-client` for connected participants; `@azure/web-pubsub` for server negotiate, publish, and manage operations |

## When to Use This Skill

- Add or migrate to Azure Web PubSub
- Replace polling, SSE, or custom WebSockets
- Build chat, live update, streaming, or gaming features

## MCP Tools

| Tool | Use |
|------|-----|
| `mcp_azure_mcp_documentation` | SDK/runtime docs for gaps |

## Workflow

1. Existing app/transport swap: [Existing App Integration](references/existing-app-integration.md).
2. Runtime: [PubSub Client SDK](references/pubsub-client-sdk.md) or [Web PubSub for Socket.IO](references/webpubsub-for-socketio.md).
3. Choose the server role with [Server Role Decision](references/server-role-decision.md): `@azure/web-pubsub-client` client pubsub; `WebPubSubServiceClient` publish/manage; `upstream` event handler.
4. Negotiation process, identity, roles, reconnect: [Negotiate Checklist](references/negotiate-checklist.md); server-owned auth boundary.
5. Browser group/reconnect edges: [Common Pitfalls](references/common-pitfalls.md).

## Error Handling

- For service/runtime errors, use the official Azure Web PubSub troubleshooting documentation: https://learn.microsoft.com/azure/azure-web-pubsub/howto-troubleshoot-guide.
