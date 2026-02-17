---
name: azure-hosted-github-sdk
description: "Build and deploy GitHub Copilot SDK apps to Azure. USE FOR: build copilot app, create copilot app, build with copilot SDK, scaffold copilot project, new copilot app, copilot SDK, copilot agent, copilot service, copilot-powered app, foundry agent, deploy copilot app, deploy to azure, host on azure, azure model, foundry model, BYOM, bring your own model, use my own model, azure openai model, DefaultAzureCredential, own endpoint, self-hosted model. DO NOT USE FOR: using Copilot (not building with it), Copilot Extensions, Azure Functions without Copilot, general web apps without copilot SDK, AI model deployment alone."
---

# GitHub Copilot SDK on Azure

## Step 1: Route

| User wants | SDK found? | Action |
|------------|-----------|--------|
| Build/create new | N/A | Step 2A (scaffold) |
| Deploy existing | ✅ Yes | Step 2B (adapt + deploy) |
| Add SDK to app | No | [Integrate SDK](references/existing-project-integration.md) |
| Use Azure/own model | Any | Step 2C (BYOM config) |

## Step 2A: Scaffold New

- **Agent** → `azd init --template jongio/copilot-sdk-agent`
- **Service** → `azd init --template jongio/copilot-sdk-service`

Templates include infra, Dockerfiles, token scripts — do NOT recreate. See [SDK ref](references/copilot-sdk.md).

## Step 2B: Deploy Existing SDK App

User brings code that already uses the Copilot SDK. Adapt it using template patterns.

1. Read template infra via `github-mcp-server-get_file_contents` — see [deploy ref](references/deploy-existing.md)
2. Add `scripts/get-github-token.mjs` (token injection script)
3. Add `azure.yaml` with `preprovision` + `prerun` hooks calling the token script
4. Add `infra/` with Bicep: Key Vault → stores `GITHUB_TOKEN`, Managed Identity → `Key Vault Secrets User`, Container App → `secretRef` from Key Vault
5. Add `Dockerfile` if missing

## Step 2C: Azure Model (BYOM)

Layers on top of 2A/2B — scaffold or deploy first, then add BYOM. See [BYOM config ref](references/azure-model-config.md).

1. Add `@azure/identity` dep, get token via `DefaultAzureCredential`
2. Pass token as `bearerToken` in `provider` config, set model = Azure deployment name
3. `listModels()` only returns Copilot models — use MCP tool `foundry_models_deployments_list` to discover Azure deployments

## Step 3: Deploy

Invoke **azure-prepare** → **azure-validate** → **azure-deploy** in order.

## Rules

- Read `AGENTS.md` in user's repo before changes
- Docker required (`docker info`)
