---
name: azure-hosted-github-sdk
description: "Build apps with the GitHub Copilot SDK and deploy to Azure. Three paths: Agent (multi-turn, tool-using, Foundry-integrable), Service (API endpoints, scripts, automation), and Deploy Existing (bring your own Copilot SDK app to Azure). USE FOR: copilot SDK, @github/copilot-sdk, copilot agent, copilot service, embed copilot, copilot-powered app, foundry agent, AI agent, AI service, AI endpoint, task automation, copilot script, deploy copilot app, host copilot SDK on Azure. DO NOT USE FOR: using Copilot (not building with it), Copilot Extensions (use copilot-extensions skill), Azure Functions without Copilot (use azure-functions), general web apps (use azure-prepare), AI model deployment alone (use microsoft-foundry)."
---

# GitHub Copilot SDK on Azure

Build, integrate, or deploy Copilot SDK apps to Azure.

## Quick Reference

| Property | Value |
|----------|-------|
| Paths | Agent · Service · Deploy Existing |
| Templates | `jongio/copilot-sdk-agent` · `jongio/copilot-sdk-service` |
| Deploy | azure-prepare → azure-validate → azure-deploy |

## Path Detection

```
"agent" / "foundry" / "chat"           → Agent
"service" / "API" / "endpoint"         → Service
existing @github/copilot-sdk + "deploy"
  or "host" or "Azure"                 → Deploy Existing
ambiguous                              → ask user
```

## Workflow

### Step 1: Detect Project

Scan for `package.json` with `@github/copilot-sdk`, `go.mod`, `requirements.txt`, `*.csproj`.

- Has SDK code + wants Azure → Step 2C
- Has code, no SDK → Step 2A
- Empty → Step 2B

### Step 2A: Integrate SDK into Existing Project

Follow [Existing Project Integration](references/existing-project-integration.md).

### Step 2B: Scaffold New Project

- **Agent** → `azd init --template jongio/copilot-sdk-agent`
- **Service** → `azd init --template jongio/copilot-sdk-service`

See [SDK ref](references/copilot-sdk.md). Templates include infra and Dockerfiles — do NOT recreate.

### Step 2C: Deploy Existing SDK App

Project already uses `@github/copilot-sdk`. Add Azure hosting:

1. Identify services, ports, entry points
2. Add `Dockerfile` if missing
3. Add `azure.yaml` pointing to service
4. Add `infra/` with Bicep for Container App (use template as reference)
5. Go to Step 4

### Step 3: Test

`azd app run` to run locally.

### Step 4: Deploy

1. **azure-prepare** — skip if template already has `azure.yaml`/`infra`
2. **azure-validate** → **azure-deploy**

## Rules

- Read template's `AGENTS.md` before changes
- Docker required (`docker info` to verify)
