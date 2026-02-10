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
| Hosting | Container Apps via AZD |

## When to Use This Skill

- Build an app with the Copilot SDK or create a Copilot Extension
- Deploy a Copilot-powered app to Azure

## Path Detection

"Copilot SDK" / "@github/copilot-sdk" → **SDK path**. "Copilot Extension" / "webhook" → **Extensions path**. Ambiguous → ask.

## Prerequisites

Run `docker info`. If it fails, **stop** — install Docker Desktop first.

## Workflow

### Step 1: Scaffold + Customize

- **SDK path** → Run `azd init --template jongio/copilot-sdk-agent`. Then read `src/index.ts` and modify `systemMessage`, `defineTool()` calls, and model to match user's use case. Install any new deps. See [Copilot SDK reference](references/copilot-sdk.md).
- **Extensions path** → [Extensions reference](references/sdk-scaffold.md)

> ⚠️ SDK template includes infra, test UI, Dockerfile — do NOT invoke **azure-prepare** or recreate these.

### Step 2: Test

SDK template includes test UI at `/test.html`. Extensions path: see [test harness](references/test-harness.md).

### Step 3: Deploy

- **SDK path:** `azd up` directly. See [Azure hosting](references/azure-hosting.md).
- **Extensions path:** **azure-prepare** → **azure-validate** → **azure-deploy**

### Step 4: Foundry Bridge (Optional)

See [Foundry bridge](references/foundry-bridge.md).

## Critical Rules

> ⛔ **Secrets:** GITHUB_TOKEN → **Key Vault** only. Use [preprovision hook](references/azure-hosting.md) to inject from `gh auth token`.

> ⛔ **ACR:** Use **managed identity** for ACR pull. Never `adminUserEnabled: true`.

> ⚠️ **SSE:** Set all four headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

> ⚠️ **Ports:** PORT, EXPOSE, targetPort, `app.listen` → all **3000**. **No inline HTML** in TypeScript — use `public/` + `express.static()`.

## Errors

See [error reference](references/errors.md).
