# Copilot Extensions Reference

Code patterns for `@copilot-extensions/preview-sdk` — webhook agents for GitHub Copilot Chat.

## Dependencies

```bash
pnpm install @copilot-extensions/preview-sdk express
pnpm install -D @types/express typescript ts-node @types/node
```

## Minimal Extension (TypeScript)

```typescript
import express from "express";
import {
  verifyAndParseRequest,
  createAckEvent, createTextEvent, createDoneEvent,
} from "@copilot-extensions/preview-sdk";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/agent", async (req, res) => {
  const { isValidRequest, payload } = await verifyAndParseRequest(
    JSON.stringify(req.body),
    req.headers["github-public-key-signature"] as string,
    req.headers["github-public-key-identifier"] as string,
    { token: process.env.GITHUB_TOKEN! }
  );
  if (!isValidRequest) { res.status(401).send("Unauthorized"); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const lastMessage = payload.messages[payload.messages.length - 1]?.content ?? "";
  res.write(createAckEvent());
  res.write(createTextEvent(`You said: ${lastMessage}`));
  res.write(createDoneEvent());
  res.end();
});

app.listen(process.env.PORT || 3000);
```

## Response Event Helpers

| Helper | Purpose |
|--------|---------|
| `createAckEvent()` | Acknowledge receipt (first event) |
| `createTextEvent(text)` | Stream text content |
| `createDoneEvent()` | Signal completion (last event) |
| `createConfirmationEvent()` | User confirmation prompt |
| `createReferencesEvent()` | Attach file references |

## Request Verification

Always verify via `verifyAndParseRequest(body, signature, keyId, { token })`. Required headers: `github-public-key-signature`, `github-public-key-identifier`.

## Testing

Create `public/test.html` and serve with `express.static()`. POST to the agent endpoint to test SSE streaming.

## Hosting

Extensions apps need **azure-prepare** to scaffold infra. Key requirements:
- Public HTTPS endpoint
- SSE-compatible hosting (Container Apps or App Service with `webSocketsEnabled`)
- GITHUB_TOKEN via Key Vault

## Errors

| Error | Fix |
|-------|-----|
| SSE responses truncated | Set `X-Accel-Buffering: no` header |
| 401 on agent endpoint | Check GITHUB_TOKEN and Key-Id header |
| `verifyAndParseRequest` invalid | Use `github-public-key-signature` header |
