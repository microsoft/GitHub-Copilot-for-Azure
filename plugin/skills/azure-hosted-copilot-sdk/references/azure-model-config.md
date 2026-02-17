# Azure Model Configuration (BYOM)

Configure Azure AI Foundry or Azure OpenAI models as Bring Your Own Model (BYOM) providers with the GitHub Copilot SDK.

## Provider Config

| Endpoint type | `type` | `baseUrl` pattern |
|---|---|---|
| Azure AI Foundry | `openai` | `https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/` |
| Azure OpenAI | `azure` | `https://<resource>.openai.azure.com` |

- **Foundry**: use `type: "openai"`, `wireApi: "responses"`, include `/openai/v1/` in URL
- **Azure OpenAI**: use `type: "azure"`, do NOT include `/openai/v1/` — SDK handles path
- `model` = Azure deployment name (required)

## DefaultAzureCredential Pattern

```typescript
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();
const { token } = await credential.getToken("https://cognitiveservices.azure.com/.default");

const session = await client.createSession({
    model: process.env.AZURE_DEPLOYMENT_NAME || "gpt-4o",
    provider: {
        type: "openai",
        baseUrl: process.env.AZURE_AI_FOUNDRY_PROJECT_ENDPOINT + "/openai/v1/",
        bearerToken: token,
        wireApi: "responses",
    },
});
```

## Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `AZURE_AI_FOUNDRY_PROJECT_ENDPOINT` | `https://<resource>.services.ai.azure.com/api/projects/<project>` | Yes (Foundry) |
| `AZURE_DEPLOYMENT_NAME` | Model deployment name (e.g., `gpt-4o`) | Yes |

## Token Refresh

> ⚠️ **Warning:** `bearerToken` is static — there is no auto-refresh mechanism.

- Tokens are valid for ~1 hour
- **Production**: get a fresh token per request (session-per-request pattern)
- Long-running sessions will fail after token expiry

## Discovering Deployments

`listModels()` returns Copilot-hosted models only, NOT Azure deployments. To discover Azure deployments:

- **MCP**: use `azure-foundry` tool with `foundry_models_deployments_list` command
- **CLI**:

```bash
az cognitiveservices account deployment list --name <resource> --resource-group <rg>
```

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `model is required` | Missing `model` in BYOM config | Set `model` to Azure deployment name |
| `401 Unauthorized` | Token expired or wrong scope | Refresh via `DefaultAzureCredential.getToken()` |
| `404 Not Found` | Wrong `baseUrl` or deployment name | Verify endpoint URL pattern and deployment exists |
| `AZURE_AI_FOUNDRY_PROJECT_ENDPOINT not set` | Missing env var | Set via `azd env set` or app settings |

## Infrastructure

For BYOM deployments, add Azure AI Services to your Bicep. See the agent template: `github-mcp-server-get_file_contents` owner: `jongio`, repo: `copilot-sdk-agent`, path: `infra/resources.bicep`.
