# Model Configuration

Three model paths for the Copilot SDK. Each session needs different configuration.

## Path 1: GitHub Default

No configuration needed. SDK uses the default model.

```typescript
const session = await client.createSession({});
// or simply: client.createSession()
```

Best for: quick prototyping, no model preference.

## Path 2: GitHub Specific Model

Specify a model name. Discover available models with `listModels()`.

```typescript
const models = await client.listModels();
// Pick from available models
const session = await client.createSession({
  model: "gpt-4o",
});
```

## Path 3: Azure BYOM (Bring Your Own Model)

Use your own Azure AI deployment with `DefaultAzureCredential`.

### Provider Config

| Endpoint type | `type` | `baseUrl` pattern |
|---|---|---|
| Azure OpenAI | `azure` | `https://<resource>.openai.azure.com` |
| Azure AI Foundry | `openai` | `https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/` |

### Code Pattern

```typescript
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();
const { token } = await credential.getToken("https://cognitiveservices.azure.com/.default");

const session = await client.createSession({
    model: process.env.AZURE_DEPLOYMENT_NAME || "gpt-4o",
    provider: {
        type: "azure",
        baseUrl: process.env.AZURE_OPENAI_ENDPOINT,
        bearerToken: token,
    },
});
```

### Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `AZURE_OPENAI_ENDPOINT` | `https://<resource>.openai.azure.com` | Yes |
| `AZURE_DEPLOYMENT_NAME` | Model deployment name | Yes |

### Token Refresh

> ⚠️ **Warning:** `bearerToken` is static — no auto-refresh.

- Tokens valid ~1 hour
- **Production**: get fresh token per request
- Long-running sessions fail after expiry

### Discovering Azure Deployments

`listModels()` returns GitHub models only. For Azure deployments:

```bash
az cognitiveservices account deployment list --name <resource> --resource-group <rg>
```

## Template Environment Variables

The template uses env vars for model path selection:

| Variable | Values | Effect |
|----------|--------|--------|
| `MODEL_PROVIDER` | unset or `azure` | Selects GitHub or Azure BYOM |
| `MODEL_NAME` | model/deployment name | Selects specific model |
| `AZURE_OPENAI_ENDPOINT` | Azure endpoint URL | Required for BYOM |

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `model is required` | Missing `model` in BYOM config | Set `MODEL_NAME` env var |
| `401 Unauthorized` | Token expired or wrong scope | Refresh via `DefaultAzureCredential` |
| `404 Not Found` | Wrong endpoint or deployment name | Verify URL and deployment exists |
