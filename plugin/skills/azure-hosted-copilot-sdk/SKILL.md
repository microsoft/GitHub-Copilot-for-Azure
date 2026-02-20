---
name: azure-hosted-copilot-sdk
description: "Build and deploy GitHub Copilot SDK apps to Azure. USE FOR: build copilot app, create copilot app, copilot SDK, @github/copilot-sdk, scaffold copilot project, copilot-powered app, deploy copilot app, host on azure, azure model, BYOM, bring your own model, use my own model, azure openai model, DefaultAzureCredential, self-hosted model, copilot SDK service, chat app with copilot, copilot-sdk-service template, azd init copilot, CopilotClient, createSession, sendAndWait, GitHub Models API. DO NOT USE FOR: using Copilot (not building with it), Copilot Extensions, Azure Functions without Copilot, general web apps without copilot SDK, Foundry agent hosting (use microsoft-foundry skill), agent evaluation (use microsoft-foundry skill)."
---

# GitHub Copilot SDK on Azure

## Step 1: Route

| User wants | Action |
|------------|--------|
| Build/create new | Step 2A (scaffold) |
| Deploy existing | Step 2B (adapt + deploy) |
| Add SDK to existing app | [Integrate SDK](references/existing-project-integration.md) |
| Use Azure/own model | Step 2C (BYOM config) |

## Step 2A: Scaffold New

`azd init --template azure-samples/copilot-sdk-service`

Template includes API (Express/TS) + Web UI (React/Vite) + infra (Bicep) + Dockerfiles + token scripts — do NOT recreate. See [SDK ref](references/copilot-sdk.md).

## Step 2B: Deploy Existing SDK App

Scaffold to a temp dir, then copy infra into the user's project:

```bash
azd init --template azure-samples/copilot-sdk-service --cwd <temp-dir>
```

Copy `infra/`, `scripts/get-github-token.mjs`, and `azure.yaml` into the user's project. Adapt `azure.yaml` to point at their code. See [deploy ref](references/deploy-existing.md).

## Step 2C: Model Configuration

Three model paths (layers on top of 2A/2B):

| Path | Config |
|------|--------|
| **GitHub default** | No `model` param — SDK picks default |
| **GitHub specific** | `model: "<name>"` — use `listModels()` to discover |
| **Azure BYOM** | `model` + `provider` with `bearerToken` via `DefaultAzureCredential` |

See [model config ref](references/azure-model-config.md).

## Step 3: Deploy

Invoke **azure-prepare** → **azure-validate** → **azure-deploy** in order.

## Rules

- Read `AGENTS.md` in user's repo before changes
- Docker required (`docker info`)
