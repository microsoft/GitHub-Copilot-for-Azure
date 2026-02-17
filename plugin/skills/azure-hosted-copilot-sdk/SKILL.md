---
name: azure-hosted-copilot-sdk
description: "Build and deploy GitHub Copilot SDK apps to Azure. USE FOR: build copilot app, create copilot app, copilot SDK, scaffold copilot project, copilot agent, copilot service, copilot-powered app, foundry agent, deploy copilot app, host on azure, azure model, foundry model, BYOM, bring your own model, use my own model, azure openai model, DefaultAzureCredential, self-hosted model. DO NOT USE FOR: using Copilot (not building with it), Copilot Extensions, Azure Functions without Copilot, general web apps without copilot SDK."
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

Read the matching template repo first, then adapt to the user's project. See [deploy ref](references/deploy-existing.md).

## Step 2C: Azure Model (BYOM)

Layers on top of 2A/2B. Add `@azure/identity`, get token via `DefaultAzureCredential`, pass as `bearerToken` in provider config. See [BYOM config ref](references/azure-model-config.md).

## Step 3: Deploy

Invoke **azure-prepare** → **azure-validate** → **azure-deploy** in order.

## Rules

- Read `AGENTS.md` in user's repo before changes
- Docker required (`docker info`)
