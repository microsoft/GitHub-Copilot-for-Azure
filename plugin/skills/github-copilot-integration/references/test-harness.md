# Test Harness

Built-in test interface so users can verify the app works after deployment.

> ⛔ **Never embed HTML as string literals in TypeScript.** Create a separate `public/test.html` file and serve with `express.static()`.

## File Structure

```
src/
  index.ts          # Express app — API routes only
public/
  test.html         # Test chat UI (separate file)
```

## Copilot SDK Path

### Express Setup (index.ts)

```typescript
import path from "path";

// Serve static files (test UI)
if (process.env.NODE_ENV !== "production") {
  app.use(express.static(path.join(__dirname, "..", "public")));
}

// SSE chat endpoint for test UI
app.post("/test/chat", async (req, res) => {
  const client = new CopilotClient({ githubToken: process.env.GITHUB_TOKEN });
  const session = await client.createSession({
    model: "gpt-4o", systemMessage: "You are a helpful assistant.",
  });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  session.on((event) => {
    if (event.type === "assistant.message_delta") {
      res.write(`data: ${JSON.stringify({ content: event.data.deltaContent })}\n\n`);
    }
    if (event.type === "session.idle") {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });
  await session.send({ prompt: req.body.prompt });
});
```

### Test Page (public/test.html)

Create `public/test.html` as a proper HTML file with:
- A chat form that POSTs to `/test/chat` (SDK) or `/test/agent` (Extensions)
- SSE response parsing via `ReadableStream`
- Simple CSS (system-ui font, GitHub-style message bubbles)

Access at `http://localhost:3000/test.html` (served by `express.static`).

### CLI Test Script (non-web apps)

```typescript
const client = new CopilotClient({ autoStart: true });
const session = await client.createSession({ model: "gpt-4o" });
session.on((event) => {
  if (event.type === "assistant.message_delta") {
    process.stdout.write(event.data.deltaContent ?? "");
  }
  if (event.type === "session.idle") {
    console.log();
    client.close();
  }
});
await session.send({ prompt: process.argv[2] || "Hello!" });
```

## Copilot Extensions Path

Same structure — create `public/test.html`, serve with `express.static()`, POST to `/test/agent`.

```typescript
app.post("/test/agent", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write(createAckEvent());
  for (const text of await handleAgentRequest(req.body?.message || "")) {
    res.write(createTextEvent(text));
  }
  res.write(createDoneEvent());
  res.end();
});
```

## Dockerfile — Copy public/

Add to the Dockerfile build stage:

```dockerfile
COPY --from=build /app/public ./public
```
