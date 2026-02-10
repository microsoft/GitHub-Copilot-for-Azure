---
name: github-copilot
description: "Build apps with the GitHub Copilot SDK or Copilot Extensions and deploy to Azure. Copilot SDK embeds agentic workflows in your app via @github/copilot-sdk. Copilot Extensions build webhook agents for GitHub Copilot Chat via @copilot-extensions/preview-sdk. USE FOR: copilot SDK, copilot extension, @github/copilot-sdk, embed copilot, copilot-powered app, copilot agent, build copilot extension, copilot-extensions, preview-sdk, copilot webhook, SSE streaming agent. DO NOT USE FOR: using Copilot (not building with it), Azure Functions without Copilot (use azure-functions), general web apps (use azure-prepare), AI model deployment alone (use microsoft-foundry)."
---

# GitHub Copilot SDK & Extensions

Build Copilot-powered apps and deploy to Azure.

## Quick Reference

| Property | Value |
|----------|-------|
| Paths | SDK (`@github/copilot-sdk`) · Extensions (`@copilot-extensions/preview-sdk`) |

## When to Use

- Build an app with the Copilot SDK or create a Copilot Extension
- Deploy a Copilot-powered app to Azure

## Path Detection

"Copilot SDK" / "@github/copilot-sdk" → **SDK path**. "Copilot Extension" / "webhook" → **Extensions path**.

## Prerequisites

Docker required — run `docker info` to verify.

## Workflow

### Step 1: Scaffold + Customize

- **SDK path** → Run `azd init --template jongio/copilot-sdk-agent` to scaffold the project. The template's chat app is just an example — adapt the code to the user's scenario. Build a custom UI that fits the use case (it's most likely not a chat experience). See [Copilot SDK reference](references/copilot-sdk.md).
- **Extensions path** → [Extensions reference](references/copilot-extensions.md)

> ⚠️ SDK template has infra, test UI, Dockerfile — do NOT recreate.

### Step 2: Test

SDK: template includes React web UI — run `azd app run`. Extensions: see [Extensions reference](references/copilot-extensions.md).

### Step 3: Deploy

> ⛔ **MANDATORY**: You MUST invoke these three skills IN ORDER. Do NOT run `azd up` or any deployment commands directly.

1. Invoke the **azure-prepare** skill — it creates the deployment manifest. The SDK template already has `azure.yaml`, `infra/`, and Dockerfile, so tell it not to regenerate those.
2. Invoke the **azure-validate** skill — it prompts the user for subscription/region and validates the deployment.
3. Invoke the **azure-deploy** skill — it executes the deployment.

### Step 4: Foundry Bridge (Optional)

See [Foundry bridge](references/foundry-bridge.md).

## Rules

- Read the template's `AGENTS.md` before making changes — it has coding conventions and commands
- Render markdown in agent responses properly in the UI
