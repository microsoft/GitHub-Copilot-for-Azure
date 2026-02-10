# Copilot SDK Reference

Code patterns for `@github/copilot-sdk` — embeds Copilot's agent runtime in your app via JSON-RPC to the Copilot CLI.

## Quick Start with AZD Template

```bash
azd init --template jongio/copilot-sdk-agent
```

Gives you a working TypeScript Express app with tools, SSE streaming, test UI, and Azure infra.

## Template Customization

After `azd init`, read and modify the scaffolded `src/index.ts`:

1. **Update `systemMessage`** for user's use case
2. **Replace/add `defineTool()` calls** for user's domain (see Custom Tools below)
3. **Run `npm install <pkg>`** for any new tool dependencies
4. **Keep template infra** — do NOT regenerate Dockerfile, Bicep, or `azure.yaml`

## Dependencies

```bash
npm install @github/copilot-sdk zod
```

Copilot CLI must be installed on the host. The SDK can auto-start it (`autoStart: true`).

## Minimal App (TypeScript)

```typescript
import { CopilotClient, defineTool } from "@github/copilot-sdk";
import { z } from "zod";

const client = new CopilotClient({ autoStart: true });

const session = await client.createSession({
  model: "gpt-4o",
  systemMessage: "You are a helpful assistant.",
});

const unsubscribe = session.on((event) => {
  if (event.type === "assistant.message_delta") {
    process.stdout.write(event.data.deltaContent ?? "");
  }
});

await session.sendAndWait({ prompt: "Hello, what can you do?" });
unsubscribe();
await client.close();
```

## Custom Tools

```typescript
// Zod schema (recommended)
const getWeather = defineTool("get_weather", {
  description: "Get current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
    units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  }),
  handler: async ({ city, units }) => {
    return { temperature: 22, units, city };
  },
});

const session = await client.createSession({
  model: "gpt-4o",
  tools: [getWeather],
});
```

Also supports raw JSON Schema for `parameters` instead of Zod.

## API Reference

| API | Purpose |
|---|---|
| `CopilotClient({ autoStart?, cliPath?, githubToken? })` | Manages CLI lifecycle |
| `client.createSession({ model, tools?, systemMessage?, streaming?, hooks? })` | Creates conversation |
| `session.send({ prompt })` | Send prompt (non-blocking) |
| `session.sendAndWait({ prompt })` | Send prompt and block until idle |
| `session.on(handler)` | Subscribe to all events (returns unsubscribe fn) |
| `session.abort()` | Cancel current processing |
| `session.destroy()` | Release session resources |
| `defineTool(name, { description, parameters, handler })` | Custom tool |

## Event Handling

> ⚠️ `session.on()` takes a **single callback** that receives all events. Switch on `event.type` inside the handler. Do NOT use `session.on("event_name", handler)` — that pattern does not exist.

```typescript
const unsubscribe = session.on((event) => {
  switch (event.type) {
    case "assistant.message_delta":
      process.stdout.write(event.data.deltaContent ?? "");
      break;
    case "tool.execution_start":
      console.log(`Tool: ${event.data.toolName}`);
      break;
    case "tool.execution_complete":
      console.log(`Done: ${event.data.toolCallId}`);
      break;
    case "session.error":
      console.error(event.data.message);
      break;
    case "session.idle":
      console.log("Session idle");
      break;
  }
});
```

**Key events:**

| Event | Data |
|-------|------|
| `assistant.message_delta` | `deltaContent` — streamed text chunk |
| `assistant.message` | `content` — complete message |
| `tool.execution_start` | `toolName`, `toolCallId` |
| `tool.execution_complete` | `toolCallId`, `success`, `result` |
| `session.idle` | Session finished processing |
| `session.error` | `message` — error description |

## send vs sendAndWait

| Method | Use When |
|--------|----------|
| `session.send({ prompt })` | Streaming UIs — you handle events via `session.on()` and detect completion via `session.idle` |
| `session.sendAndWait({ prompt })` | Request-response servers — blocks until idle, returns final assistant message |

## Server-Side Pattern (Express)

For web servers, create a `CopilotClient` with `githubToken` from environment and use per-request sessions:

```typescript
import express from "express";
import { CopilotClient, defineTool } from "@github/copilot-sdk";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/chat", async (req, res) => {
  const client = new CopilotClient({
    githubToken: process.env.GITHUB_TOKEN,
  });

  const session = await client.createSession({
    model: "gpt-4o",
    systemMessage: "You are a helpful assistant.",
    tools: [/* your tools */],
  });

  // SSE streaming response
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

app.listen(process.env.PORT || 3000);
```

> 💡 **Tip:** For request-response endpoints (not SSE), use `sendAndWait` instead:
>
> ```typescript
> const result = await session.sendAndWait({ prompt: req.body.prompt });
> res.json({ response: result?.data?.content });
> await client.stop();
> ```

## Session Hooks

```typescript
const session = await client.createSession({
  model: "gpt-4o",
  hooks: {
    onPreToolUse: async (toolName, args) => { return true; },
    onPostToolUse: async (toolName, result) => {},
    onUserPromptSubmitted: async (prompt) => {},
  },
});
```

## BYOK (Bring Your Own Key)

```typescript
const session = await client.createSession({
  model: "gpt-4o",
  provider: {
    type: "azure-openai",
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_KEY!,
    deploymentName: "gpt-4o",
  },
});
```

Supported: `openai`, `azure-openai`, `anthropic`, `ollama`.
