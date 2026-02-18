# azure-hosted-copilot-sdk — Feature Status

## Overview

The `azure-hosted-copilot-sdk` skill enables users to build, deploy, and configure GitHub Copilot SDK applications on Azure. It uses a single template (`azure-samples/copilot-sdk-service`) with API + Web UI deployed to Azure Container Apps. Three model paths are supported: GitHub default (no config), GitHub specific (user picks model), and Azure BYOM (DefaultAzureCredential + Azure deployment).

**Scope:** Copilot SDK app development + Azure hosting only. Foundry agent lifecycle (package/deploy/invoke) is handled by the `microsoft-foundry` skill (#865). Agent Framework integration is handled by the `agent-framework` skill.

## Current Status — PR #880

### Skill Files — ✅ Complete

| File | Purpose | Status |
|------|---------|--------|
| `SKILL.md` | Routing: scaffold → deploy → model config → deploy chain | ✅ Rewritten — single template, three model paths, no Foundry agent refs |
| `references/copilot-sdk.md` | SDK reference, template info, model paths, testing | ✅ Rewritten — removed agent/service split, Foundry integration |
| `references/azure-model-config.md` | Three model paths: GitHub default, specific, Azure BYOM | ✅ Rewritten — covers all three paths, not just BYOM |
| `references/deploy-existing.md` | Deploy workflow, Bicep, token flow, Dockerfile patterns | ✅ Rewritten — single template, removed `copilot-sdk-agent` refs |
| `references/existing-project-integration.md` | Add SDK to existing apps, BYOM integration | ✅ Rewritten — unified pattern, no agent/service split |

### Template Repo (`azure-samples/copilot-sdk-service`) — ✅ Complete

| Component | Change | Status |
|-----------|--------|--------|
| `src/api/model-config.ts` | **NEW** — shared three-path model config (GitHub default/specific, Azure BYOM) | ✅ Created |
| `src/api/routes/chat.ts` | **NEW** — POST `/chat` with SSE streaming for multi-turn conversations | ✅ Created |
| `src/api/routes/summarize.ts` | Uses `getSessionOptions()` instead of hardcoded `model: "gpt-4o"` | ✅ Updated |
| `src/api/index.ts` | Registered `/chat` route | ✅ Updated |
| `src/api/package.json` | Added `@azure/identity` dependency | ✅ Updated |
| `src/web/hooks/useService.ts` | SSE streaming client calling `/chat` instead of `/summarize` | ✅ Updated |
| `src/web/App.tsx` | Updated title/subtitle for chat UI | ✅ Updated |
| `infra/resources.bicep` | Conditional Azure OpenAI + role assignment (`useAzureModel` param) | ✅ Updated |
| `infra/main.bicep` | Added `useAzureModel` and `azureModelName` params | ✅ Updated |
| `infra/main.parameters.json` | Added BYOM parameter defaults | ✅ Updated |
| `azure.yaml` | Template metadata updated to `azure-samples/copilot-sdk-service` | ✅ Updated |
| `AGENTS.md` | Added Key Files table + Model Configuration section | ✅ Updated |
| `README.md` | Three model paths, chat endpoint, updated architecture diagrams | ✅ Updated |

### Test Automation — ✅ Tests updated, ⚠️ Skill routing issue persists

| Test File | Tests | Status |
|-----------|-------|--------|
| `triggers.test.ts` | 23 tests (10 trigger, 8 negative, 5 edge) | ✅ Updated — removed Foundry triggers |
| `unit.test.ts` | 17 tests (metadata, content, BYOM, frontmatter) | ✅ Updated — checks `copilot-sdk-service` and `AZURE_OPENAI_ENDPOINT` |
| `integration.test.ts` | 4 invocation rate + 2 content quality | ✅ Updated — removed Foundry/agent from prompts |
| `__snapshots__/triggers.test.ts.snap` | Keyword snapshots | ✅ Regenerated |
| `regression-detectors.ts` | `countApiKeyInByomConfig()` detector | ✅ Unchanged |

**Integration test detail:**
- Content quality tests (2): ✅ **Passing** — agent produces correct Copilot SDK and BYOM output
- Invocation rate tests (4): ❌ **0% rate** — `azure-prepare` skill captures prompts first

### PR Conflict Check — ✅ No conflicts

| PR | Owner | Scope | Conflicts? |
|----|-------|-------|------------|
| #865 | ankitbko | `plugin/skills/microsoft-foundry/agent/` | ❌ None |
| #914 | kuojianlu | `plugin/skills/agent-framework/` (draft) | ❌ None |
| #915 | anchenyi | `plugin/skills/agent-framework/` (draft) | ❌ None |
| #938 | JasonYeMSFT | `.github/workflows/` | ❌ None |

### What Changed in This PR (Summary)

**Removed:**
- Agent/service template split (was: `copilot-sdk-agent` + `copilot-sdk-service` → now: single `copilot-sdk-service`)
- All Foundry agent references (AIProjectClient, threads, function tools, evaluation, `host: azure.ai.agent`)
- `foundry agent`, `copilot agent` trigger phrases
- P1 (Agent Template Hosting) and P2 (Foundry Hosting) roadmap items

**Added:**
- Three model paths: GitHub default → GitHub specific → Azure BYOM
- `DO NOT USE FOR: Foundry agent hosting (use microsoft-foundry skill)`
- Chat endpoint with SSE streaming in template
- `model-config.ts` shared module for env-var-based model selection
- Conditional Azure OpenAI Bicep resources for BYOM

## Architecture

```
User prompt
  │
  ▼
┌──────────────────────────────┐
│  azure-hosted-copilot-sdk     │
│  Step 1: Route               │
├──────────────────────────────┤
│  Build new?    → Step 2A     │──→ azd init --template azure-samples/copilot-sdk-service
│  Deploy existing? → Step 2B  │──→ Adapt using template infra patterns
│  Add SDK?      → Integrate   │──→ references/existing-project-integration.md
│  Use own model? → Step 2C    │──→ references/azure-model-config.md
├──────────────────────────────┤
│  Step 3: Deploy              │──→ azure-prepare → azure-validate → azure-deploy
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

## Future Work

### P0 — Skill Routing Fix

The skill is never invoked by the Copilot CLI agent. Prompts like "build copilot SDK app" route to `azure-prepare` instead. Root cause: `azure-prepare` has an aggressive `REQUIRED FIRST STEP` instruction that captures all deployment-related prompts.

**Options:**
1. Improve skill description to outcompete `azure-prepare` for Copilot SDK-specific prompts
2. Add cross-skill routing — `azure-prepare` detects Copilot SDK projects and delegates
3. Use `systemPrompt` in the skill for stronger routing hints

### P1 — Copilot SDK Streaming

The chat endpoint currently uses `sendAndWait` (full response in one SSE event). When the SDK supports true token-level streaming, update to stream incremental chunks.

### P2 — Additional Language Templates

Current template is TypeScript/Express only. Future templates for Python (FastAPI), Go, and .NET.

## Known Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Skill never invoked by agent (0% invocation rate) | Users don't get skill-specific guidance | **High** |
| `bearerToken` is static — no auto-refresh callback in SDK | Long-running sessions fail after ~1 hour | Medium |
| `listModels()` doesn't return Azure deployments | Users must use CLI to discover deployment names | Low |
| Chat endpoint uses `sendAndWait` not true streaming | Response arrives as single chunk, not token-by-token | Low |

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
├── integration.test.ts                         # 6 integration tests (invocation rate + content)
├── triggers.test.ts                            # 23 trigger matching tests
├── unit.test.ts                                # 17 unit tests
└── __snapshots__/triggers.test.ts.snap         # Trigger keyword snapshots

tests/utils/
└── regression-detectors.ts                     # countApiKeyInByomConfig() detector
```
