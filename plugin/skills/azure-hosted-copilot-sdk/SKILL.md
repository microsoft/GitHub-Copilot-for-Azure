---
name: azure-hosted-copilot-sdk
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

Default to the **service** template unless the user explicitly asks to build an **agent**:

- **Service** (default) → `azd init --template jongio/copilot-sdk-service`
- **Agent** (only if user says "agent") → `azd init --template jongio/copilot-sdk-agent`

Templates include infra, Dockerfiles, token scripts — do NOT recreate. See [SDK ref](references/copilot-sdk.md).

## Step 2B: Deploy Existing SDK App

> **MANDATORY**: Read the template repo first to learn the required patterns, then adapt them to the user's project structure. Do NOT generate infra, scripts, or azure.yaml from scratch — but do NOT blindly copy either, since the user's project layout will differ.

1. **Read the template first** — use `github-mcp-server-get_file_contents` to read `azure.yaml`, `infra/main.bicep`, `infra/resources.bicep`, `scripts/get-github-token.mjs`, and `Dockerfile` from the matching template repo (`jongio/copilot-sdk-service` or `jongio/copilot-sdk-agent`). See [deploy ref](references/deploy-existing.md).
2. **`scripts/get-github-token.mjs`** — use the template version as-is (this script is generic)
3. **`azure.yaml`** — follow the template's hook structure but adapt `project`, `language`, `ports`, and service layout to the user's app
4. **`infra/`** — follow the template's Bicep patterns (AVM modules, Key Vault + token flow) but adapt resource names, SKUs, and app config to match what the user's app actually needs
5. **`Dockerfile`** — if the user has none, learn from the template's Dockerfile but write one that fits the user's actual entry point, dependencies, and build steps

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
