---
name: github-copilot
description: "Build apps with the GitHub Copilot SDK and deploy to Azure. Two paths: Agent (multi-turn, tool-using, Foundry-integrable) and Service (API endpoints, scripts, automation). USE FOR: copilot SDK, @github/copilot-sdk, copilot agent, copilot service, embed copilot, copilot-powered app, foundry agent, AI agent, AI service, AI endpoint, task automation, copilot script. DO NOT USE FOR: using Copilot (not building with it), Copilot Extensions (use copilot-extensions skill), Azure Functions without Copilot (use azure-functions), general web apps (use azure-prepare), AI model deployment alone (use microsoft-foundry)."
---

# GitHub Copilot SDK

Build Copilot-powered agents and services, then deploy to Azure.

## Quick Reference

| Property | Value |
|----------|-------|
| Paths | Agent · Service |
| Templates | `jongio/copilot-sdk-agent` · `jongio/copilot-sdk-service` |
| Prerequisites | Docker (`docker info` to verify) |
| Deploy | azure-prepare → azure-validate → azure-deploy |

## When to Use

- Build a multi-turn AI agent with tools, streaming, and Foundry integration
- Add Copilot SDK features to an API, script, or automation

## Path Detection

```
"agent" / "foundry" / "chat"              → Agent
"service" / "API" / "endpoint" /
  "script" / "automate"                   → Service
```

## Workflow

### Step 1: Detect Project

Scan for `package.json`, `go.mod`, `requirements.txt`, `*.csproj`. Existing code → Step 2A. Empty → Step 2B.

### Step 2A: Integrate into Existing Project

Follow [Existing Project Integration](references/existing-project-integration.md). Study template via MCP tools, add SDK, create routes.

### Step 2B: Scaffold New Project

- **Agent** → `azd init --template jongio/copilot-sdk-agent` — [SDK ref](references/copilot-sdk.md)
- **Service** → `azd init --template jongio/copilot-sdk-service` — [SDK ref](references/copilot-sdk.md)

> ⚠️ Templates include infra, Dockerfiles, test UI — do NOT recreate.

### Step 3: Test

`azd app run` for both scenarios.

### Step 4: Deploy

> ⛔ Invoke skills IN ORDER. Do NOT run `azd up` directly.

1. **azure-prepare** — template already has `azure.yaml`/`infra` — skip regeneration
2. **azure-validate** — prompts for subscription/region
3. **azure-deploy** — executes deployment

## Rules

- Read template's `AGENTS.md` before changes — has coding conventions
- Render markdown in agent responses properly in UI
