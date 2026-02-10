# Foundry Bridge for Copilot Extensions

How to bridge a GitHub Copilot Extension to an Azure AI Foundry hosted agent. This pattern lets Foundry manage the AI agent runtime while GitHub handles the Extension webhook.

## Architecture

```
GitHub Copilot → Extension webhook (POST /agent)
                     │
                     ▼
              Bridge Service (Express + SSE)
                     │
                     ├── Verify request (preview-sdk)
                     ├── Translate webhook → Foundry agent format
                     ├── Call Foundry agent API
                     └── Stream Foundry response → SSE events
                     │
                     ▼
              Azure AI Foundry Hosted Agent
                     │
                     ├── GPT-4o model
                     ├── AI Search (grounding)
                     └── Tools (code interpreter, file search)
```

## Bridge Service Code

The bridge translates between GitHub's Copilot Extension format and Foundry's agent API:

```typescript
import express from "express";
import { verifyAndParseRequest, createAckEvent, createTextEvent, createDoneEvent } from "@copilot-extensions/preview-sdk";
import { AgentsClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const app = express();
app.use(express.json());

const credential = new DefaultAzureCredential();
const projectClient = new AgentsClient("<foundry-endpoint>", credential);

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
  res.setHeader("X-Accel-Buffering", "no");

  res.write(createAckEvent());

  // Forward to Foundry agent
  const lastMessage = payload.messages[payload.messages.length - 1]?.content ?? "";
  const thread = await projectClient.threads.create();
  await projectClient.messages.create(thread.id, { role: "user", content: lastMessage });
  const run = await projectClient.runs.createAndPoll(thread.id, { assistantId: process.env.FOUNDRY_AGENT_ID! });

  if (run.status === "completed") {
    const messages = await projectClient.messages.list(thread.id);
    const assistantMsg = messages.data.find(m => m.role === "assistant");
    const text = assistantMsg?.content?.[0]?.type === "text"
      ? assistantMsg.content[0].text.value : "No response";
    res.write(createTextEvent(text));
  } else {
    res.write(createTextEvent(`Agent run failed: ${run.status}`));
  }

  res.write(createDoneEvent());
  res.end();
});
```

## Dependencies

```bash
pnpm install @copilot-extensions/preview-sdk @azure/ai-projects @azure/identity express
```

## Deployment

The bridge deploys as a separate service alongside the Foundry agent:

| Component | Hosting | Purpose |
|-----------|---------|---------|
| Bridge service | App Service or Container Apps | Webhook endpoint for GitHub |
| Foundry agent | Azure AI Foundry (managed) | AI agent runtime |
| GPT-4o | Foundry model deployment | Language model |
| AI Search | Azure AI Search | Grounding / RAG |

Use **azure-prepare** to scaffold infrastructure for both the bridge service and the Foundry project. The bridge needs:
- Public HTTPS endpoint (for GitHub webhook)
- Managed identity (for Foundry + AI Search access)
- Key Vault reference (for GITHUB_TOKEN)
