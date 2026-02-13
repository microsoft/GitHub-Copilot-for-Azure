---
name: azure-hosted-github-sdk
description: "Build and deploy GitHub Copilot SDK apps to Azure. Auto-triggers when project depends on any Copilot SDK and user says deploy/host/build. USE FOR: copilot SDK, copilot agent, copilot service, copilot-powered app, foundry agent, deploy copilot app, deploy to azure, host on azure. DO NOT USE FOR: using Copilot (not building with it), Copilot Extensions, Azure Functions without Copilot, general web apps without copilot SDK, AI model deployment alone."
---

# GitHub Copilot SDK on Azure

## Auto-Detection

Activate this skill when:
1. User prompt mentions "copilot SDK" / "copilot agent" / "copilot service", OR
2. Project has a Copilot SDK dependency (any language) and user says deploy/host/build

**SDK dependency markers** — check these before routing to azure-prepare:

| File | Dependency |
|------|-----------|
| `package.json` | `@github/copilot-sdk` |
| `requirements.txt` / `pyproject.toml` | `github-copilot-sdk` |
| `go.mod` | `github.com/github/copilot-sdk-go` |
| `*.csproj` | `GitHub.CopilotSdk` |

> ⚠️ If ANY of these are found and user asks to deploy, use THIS skill — not azure-prepare.

## Path Detection

```
"agent" / "foundry" / "chat"        → Agent
"service" / "API" / "endpoint"      → Service
SDK dependency found + "deploy"     → Deploy Existing
ambiguous                           → ask user
```

## Workflow

### Step 1: Detect Project

- Has SDK dependency + wants Azure → Step 2C
- Has code, no SDK → Step 2A
- Empty → Step 2B

### Step 2A: Integrate SDK

Follow [Existing Project Integration](references/existing-project-integration.md).

### Step 2B: Scaffold New

- **Agent** → `azd init --template jongio/copilot-sdk-agent`
- **Service** → `azd init --template jongio/copilot-sdk-service`

[SDK ref](references/copilot-sdk.md). Templates include infra + Dockerfiles — do NOT recreate.

### Step 2C: Deploy Existing SDK App

1. Identify services, ports, entry points
2. Add `Dockerfile` if missing
3. Add `azure.yaml` pointing to service
4. Add `infra/` with Bicep for Container App
5. Proceed to deploy

### Step 3: Deploy

Invoke **azure-prepare** → **azure-validate** → **azure-deploy** in order.

## Rules

- Read `AGENTS.md` before changes
- Docker required (`docker info`)
