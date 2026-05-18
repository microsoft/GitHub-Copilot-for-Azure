# azure-hosted-copilot-sdk — Feature Status

## Overview

The `azure-hosted-copilot-sdk` skill enables users to build, deploy, and configure GitHub Copilot SDK applications on Azure. It uses a single template ([`azure-samples/copilot-sdk-service`](https://github.com/Azure-Samples/copilot-sdk-service/)) with API + Web UI deployed to Azure Container Apps. Three model paths are supported: GitHub default (no config), GitHub specific (user picks model), and Azure BYOM (DefaultAzureCredential + Azure deployment).

**Scope:** Copilot SDK app development + Azure hosting only. Foundry agent lifecycle (package/deploy/invoke) is handled by the `microsoft-foundry` skill (#865). Agent Framework integration is handled by the `agent-framework` skill.

## Current Status — PR [#880](https://github.com/microsoft/GitHub-Copilot-for-Azure/pull/880)

**Branch:** `github-copilot-integration` | **State:** Open | **43 commits, 41 files changed**

### Skill Files — ✅ Complete

| File | Purpose | Status |
|------|---------|--------|
| `SKILL.md` | Routing: scaffold → deploy → model config → deploy chain | ✅ Complete — single template, three model paths, no Foundry agent refs |
| `references/copilot-sdk.md` | SDK reference, template info, model paths, testing | ✅ Complete |
| `references/azure-model-config.md` | Three model paths: GitHub default, specific, Azure BYOM | ✅ Complete |
| `references/deploy-existing.md` | Deploy workflow, Bicep, token flow, Dockerfile patterns | ✅ Complete |
| `references/existing-project-integration.md` | Add SDK to existing apps, BYOM integration | ✅ Complete |

### Template Repo ([`azure-samples/copilot-sdk-service`](https://github.com/Azure-Samples/copilot-sdk-service/)) — ✅ Complete

| Component | Change | Status |
|-----------|--------|--------|
| `src/api/model-config.ts` | Shared three-path model config with per-request token refresh for Azure BYOM | ✅ |
| `src/api/routes/chat.ts` | POST `/chat` with true SSE streaming via `assistant.message_delta` events | ✅ |
| `src/api/routes/summarize.ts` | Uses `getSessionOptions()` instead of hardcoded `model: "gpt-4o"` | ✅ |
| `src/api/index.ts` | Registered `/chat` route | ✅ |
| `src/api/package.json` | Added `@azure/identity` dependency | ✅ |
| `src/web/hooks/useService.ts` | SSE streaming client calling `/chat` instead of `/summarize` | ✅ |
| `src/web/App.tsx` | Updated title/subtitle for chat UI | ✅ |
| `infra/resources.bicep` | Conditional Azure OpenAI + role assignment (`useAzureModel` param) | ✅ |
| `infra/main.bicep` | Added `useAzureModel` and `azureModelName` params | ✅ |
| `infra/main.parameters.json` | Added BYOM parameter defaults | ✅ |
| `azure.yaml` | Template metadata updated to `azure-samples/copilot-sdk-service` | ✅ |
| `AGENTS.md` | Added Key Files table + Model Configuration section | ✅ |
| `README.md` | Three model paths, chat endpoint, updated architecture diagrams | ✅ |

### Test Automation — ✅ Complete

| Test File | Tests | Status |
|-----------|-------|--------|
| `triggers.test.ts` | 5 test blocks (10 trigger, 8 negative, 5 edge cases) | ✅ Complete |
| `unit.test.ts` | 17 tests (metadata, content, BYOM, frontmatter) | ✅ Complete |
| `integration.test.ts` | 8 tests (invocation rate + content quality) | ✅ Complete |
| `__snapshots__/triggers.test.ts.snap` | Keyword snapshots | ✅ Regenerated |

### Test Infrastructure — ✅ Complete

| File | Purpose | Status |
|------|---------|--------|
| `tests/utils/agent-runner.ts` | Enhanced with `runConversation()` for multi-turn scenarios | ✅ |
| `tests/utils/evaluate.ts` | Shared evaluation helpers (`matchesCommand`, `getAllAssistantMessages`, etc.) | ✅ |
| `tests/utils/regression-detectors.ts` | Regression detectors (secrets, ACR spirals, port confusion, etc.) | ✅ |

### Local Dev Tooling — 🔄 Replaced

The local development scripts (`scripts/src/local/`) have been replaced by the Gulp build system. Developers now run `npm run build` at the repo root and use `copilot --plugin-dir ./output` to test locally.

### What Changed in This PR

**Added:**
- `azure-hosted-copilot-sdk` skill with 5 reference files
- Three model paths: GitHub default → GitHub specific → Azure BYOM
- `DO NOT USE FOR: Foundry agent hosting (use microsoft-foundry skill)`
- Test suite: triggers, unit, and integration tests
- Test infrastructure: `evaluate.ts` shared helpers, `regression-detectors.ts`
- Local dev tooling: `setup`, `verify`, `test` commands
- Optional context7 MCP server usage (not pre-configured; users must install `@upstash/context7-mcp` separately)
- Specialized routing in `azure-prepare` to delegate to `azure-hosted-copilot-sdk`

**Not included:**
- Agent/service template split (single `copilot-sdk-service` template only)
- Foundry agent references (handled by `microsoft-foundry` skill)

## Architecture

```
User prompt
  │
  ▼
┌──────────────────────────────┐
│  azure-hosted-copilot-sdk     │
│  Step 1: Route               │
├──────────────────────────────┤
│  Build new?      → Step 2A   │──→ azd init --template azure-samples/copilot-sdk-service
│  Add alongside?  → Step 2B   │──→ Scaffold to temp dir, copy into existing repo
│  Deploy existing?→ Step 2C   │──→ Add infra to existing SDK app
│  Integrate SDK?  → Ref       │──→ references/existing-project-integration.md
│  Use own model?  → Step 3    │──→ references/azure-model-config.md
├──────────────────────────────┤
│  Step 4: Deploy              │──→ azure-prepare → azure-validate → azure-deploy
└──────────────────────────────┘
```

### Three Model Paths

```
Copilot SDK Session
  │
  ├─ GitHub Default (no config)
  │    SDK picks default model
  │    Auth: GITHUB_TOKEN
  │    Env: (none)
  │
  ├─ GitHub Specific (model only)
  │    User picks model via listModels()
  │    Auth: GITHUB_TOKEN
  │    Env: MODEL_NAME=gpt-4o
  │
  └─ Azure BYOM (model + provider)
       User's Azure deployment
       Auth: DefaultAzureCredential → bearerToken
       Env: MODEL_PROVIDER=azure, MODEL_NAME=<deployment>, AZURE_OPENAI_ENDPOINT=<url>
```

### Template Architecture

```
azure-samples/copilot-sdk-service/
├── src/api/                     # Express API (Node 24, TypeScript)
│   ├── model-config.ts          # Three-path model selection
│   ├── routes/chat.ts           # POST /chat — SSE streaming
│   ├── routes/summarize.ts      # POST /summarize — one-shot
│   └── routes/health.ts         # GET /health
├── src/web/                     # React + Vite chat UI
│   ├── hooks/useService.ts      # SSE streaming client
│   └── components/              # ChatWindow, MessageInput, ThemeToggle
├── infra/
│   ├── main.bicep               # Subscription-scoped (useAzureModel param)
│   └── resources.bicep          # Container Apps + conditional Azure OpenAI
├── scripts/get-github-token.mjs # azd hook for GITHUB_TOKEN
└── azure.yaml                   # API + Web services, preprovision/prerun hooks
```

## Known Issues

No blocking issues at this time.

## Future Work

### P1 — Additional Language Templates

Current template is TypeScript/Express only. Future templates for Python (FastAPI), Go, and .NET.

### P2 — Plugin-Side Template Source Configuration

Add ability for the `azure-hosted-copilot-sdk` skill to reference local template directories (using the `azd init --template <local-dir>` support added in the `azure-dev` CLI). This would enable the skill to point at a local template checkout during development instead of always pulling from `azure-samples/copilot-sdk-service`.

## File Inventory

```
plugin/skills/azure-hosted-copilot-sdk/
├── SKILL.md                                    # Main skill (routing + steps)
└── references/
    ├── azure-model-config.md                   # Three model paths + BYOM config
    ├── copilot-sdk.md                          # SDK reference + template info
    ├── deploy-existing.md                      # Deploy workflow + Bicep infra
    └── existing-project-integration.md         # Add SDK to existing apps

docs/spec/
└── azure-hosted-copilot-sdk.md                 # This file — feature status

tests/azure-hosted-copilot-sdk/
├── integration.test.ts                         # 8 integration tests
├── triggers.test.ts                            # 5 test blocks (23 parameterized cases)
└── __snapshots__/triggers.test.ts.snap         # Trigger keyword snapshots

tests/utils/
├── agent-runner.ts                             # Agent runner with runConversation()
├── evaluate.ts                                 # Shared evaluation helpers
└── regression-detectors.ts                     # Regression detectors
```
