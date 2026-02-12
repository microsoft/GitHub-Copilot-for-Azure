---
name: github-copilot
description: "Build apps with the GitHub Copilot SDK or Copilot Extensions and deploy to Azure. Copilot SDK embeds agentic workflows in your app via @github/copilot-sdk. Copilot Extensions build webhook agents for GitHub Copilot Chat via @copilot-extensions/preview-sdk. USE FOR: copilot SDK, copilot extension, @github/copilot-sdk, embed copilot, copilot-powered app, copilot agent, build copilot extension, copilot-extensions, preview-sdk, copilot webhook, SSE streaming agent. DO NOT USE FOR: using Copilot (not building with it), Azure Functions without Copilot (use azure-functions), general web apps (use azure-prepare), AI model deployment alone (use microsoft-foundry)."
---

# GitHub Copilot SDK & Extensions

Build Copilot-powered apps and deploy to Azure.

## Quick Reference

| Property | Value |
|----------|-------|
| Paths | SDK (Copilot SDK) · Extensions (Copilot Extensions) |

## When to Use

- Build an app with the Copilot SDK or create a Copilot Extension
- Integrate Copilot SDK into an existing application
- Deploy a Copilot-powered app to Azure

## Path Detection

"Copilot SDK" / "@github/copilot-sdk" → **SDK path**. "Copilot Extension" / "webhook" → **Extensions path**.

## Prerequisites

Docker required — run `docker info` to verify.

## Workflow

### Step 1: Detect Project Type

Scan workspace for `package.json`, `go.mod`, `requirements.txt`, `*.csproj`, or source files.

- **Existing code found** → Step 2A
- **Empty / no code** → Step 2B

### Step 2A: Integrate into Existing Project

Follow the [Existing Project Integration guide](references/existing-project-integration.md). Study the template via MCP tools, add SDK dependency, create agent routes, wire into existing app.

### Step 2B: Scaffold New Project

- **SDK** → `azd init --template jongio/copilot-sdk-agent`. Adapt the example to the user's scenario. See [SDK reference](references/copilot-sdk-agent.md).
- **Extensions** → [Extensions reference](references/copilot-extensions.md)

> ⚠️ SDK template includes infra, test UI, Dockerfile — do NOT recreate.

### Step 3: Test

SDK: `azd app run`. Extensions: see [Extensions reference](references/copilot-extensions.md).

### Step 4: Deploy

> ⛔ Invoke these skills IN ORDER. Do NOT run `azd up` directly.

1. **azure-prepare** — creates deployment manifest (SDK template already has `azure.yaml`/`infra`/Dockerfile — skip regeneration)
2. **azure-validate** — prompts for subscription/region
3. **azure-deploy** — executes deployment

## Rules

- Read the template's `AGENTS.md` before making changes — it has coding conventions and commands
- Render markdown in agent responses properly in the UI
