---
name: azure-hosted-copilot-sdk
description: "Build, deploy, modify GitHub Copilot SDK apps on Azure. PREFER OVER azure-prepare when codebase contains copilot-sdk markers. WHEN: copilot SDK, @github/copilot-sdk, copilot-powered app, deploy copilot app, add feature, modify copilot app, BYOM, bring your own model, CopilotClient, createSession, sendAndWait, azd init copilot. DO NOT USE FOR: general web apps without copilot SDK (use azure-prepare), Copilot Extensions, Foundry agents (use microsoft-foundry)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.4"
---

# GitHub Copilot SDK on Azure

## Codebase Detection — MANDATORY FIRST CHECK

**Before routing to azure-prepare for ANY prompts involving an existing codebase**, scan the workspace for Copilot SDK markers. If ANY marker is found, this skill MUST be used instead of azure-prepare:

| Marker | Where to check |
|--------|---------------|
| `@github/copilot-sdk` | `package.json` dependencies |
| `copilot-sdk` | `package.json` name or dependencies |
| `CopilotClient` | Source files (`.ts`, `.js`) |
| `createSession` + `sendAndWait` | Source files (`.ts`, `.js`) |

> ⚠️ **Warning:** ANY prompt targeting an existing codebase — deploy, modify, add feature, update, enhance — MUST trigger this skill when codebase contains `@github/copilot-sdk`, even if the prompt does not mention "copilot". Do NOT fall through to azure-prepare.

## Step 1: Route

| User wants | Action |
|------------|--------|
| Build new (empty project) | Step 2A (scaffold) |
| Add new SDK service to existing repo | Step 2B (scaffold alongside) |
| Deploy existing SDK app to Azure | Step 2C (add infra to existing SDK app) |
| Modify/add features to existing SDK app | Use codebase context + SDK references to implement |
| Add SDK to existing app code | [Integrate SDK](references/existing-project-integration.md) |
| Use Azure/own model | Step 3 (BYOM config) |

## Step 2A: Scaffold New (Greenfield)

`azd init --template azure-samples/copilot-sdk-service`

Template includes API (Express/TS) + Web UI (React/Vite) + infra (Bicep) + Dockerfiles + token scripts — do NOT recreate. See [SDK ref](references/copilot-sdk.md).

## Step 2B: Add SDK Service to Existing Repo

User has existing code and wants a new Copilot SDK service alongside it. Scaffold template to a temp dir, copy the API service + infra into the user's repo, adapt `azure.yaml` to include both existing and new services. See [deploy existing ref](references/deploy-existing.md).

## Step 2C: Deploy Existing SDK App

User already has a working Copilot SDK app and needs Azure infra. See [deploy existing ref](references/deploy-existing.md).

## Step 3: Model Configuration

Three model paths (layers on top of 2A/2B):

| Path | Config |
|------|--------|
| **GitHub default** | No `model` param — SDK picks default |
| **GitHub specific** | `model: "<name>"` — use `listModels()` to discover |
| **Azure BYOM** | `model` + `provider` with `bearerToken` via `DefaultAzureCredential` |

> ⚠️ **BYOM Auth — MANDATORY**: Azure BYOM configurations MUST use `DefaultAzureCredential` (local dev) or `ManagedIdentityCredential` (production) to obtain a `bearerToken`. **NEVER** use static API keys (`apiKey`), `AZURE_OPENAI_API_KEY`, or `AZURE_OPENAI_KEY` environment variables in BYOM provider configuration. See [auth-best-practices.md](references/auth-best-practices.md) for the credential pattern and [model config ref](references/azure-model-config.md) for the full BYOM code example.

See [model config ref](references/azure-model-config.md).

## Step 4: Deploy

Invoke **azure-prepare** (skip its Step 0 routing — scaffolding is done) → **azure-validate** → **azure-deploy** in order.

## Rules

- Read `AGENTS.md` in user's repo before changes
- Docker required (`docker info`)
- BYOM auth: always `bearerToken` via `DefaultAzureCredential` or `ManagedIdentityCredential` — never `apiKey` or `AZURE_OPENAI_API_KEY`/`AZURE_OPENAI_KEY`
