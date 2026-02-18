# azure-hosted-copilot-sdk — Feature Status

## Overview

The `azure-hosted-copilot-sdk` skill enables users to build, deploy, and configure GitHub Copilot SDK applications on Azure. It uses a single template (`azure-samples/copilot-sdk-service`) with API + Web UI deployed to Azure Container Apps. Three model paths are supported: GitHub default (no config), GitHub specific (user picks model), and Azure BYOM (DefaultAzureCredential + Azure deployment).

**Scope:** Copilot SDK app development + Azure hosting only. Foundry agent lifecycle (package/deploy/invoke) is handled by the `microsoft-foundry` skill (#865). Agent Framework integration is handled by the `agent-framework` skill.

## Current Status — PR [#880](https://github.com/microsoft/GitHub-Copilot-for-Azure/pull/880)

**Branch:** `github-copilot-integration` | **State:** Open, mergeable, blocked (`pending-owner-action`) | **29 commits, 38 files changed**

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
| `src/api/model-config.ts` | **NEW** — shared three-path model config with per-request token refresh for Azure BYOM | ✅ Created |
| `src/api/routes/chat.ts` | **NEW** — POST `/chat` with true SSE streaming via `assistant.message_delta` events | ✅ Created |
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

### Test Automation — ✅ Tests complete, ⚠️ Skill routing issue persists

| Test File | Tests | Status |
|-----------|-------|--------|
| `triggers.test.ts` | 23 tests (10 trigger, 8 negative, 5 edge) | ✅ Complete — removed Foundry triggers |
| `unit.test.ts` | 17 tests (metadata, content, BYOM, frontmatter) | ✅ Complete — checks `copilot-sdk-service` and `AZURE_OPENAI_ENDPOINT` |
| `integration.test.ts` | 4 invocation rate + 2 content quality | ✅ Complete — removed Foundry/agent from prompts |
| `__snapshots__/triggers.test.ts.snap` | Keyword snapshots | ✅ Regenerated |
| `regression-detectors.ts` | `countApiKeyInByomConfig()` detector | ✅ Unchanged |

**Integration test detail:**
- Content quality tests (2): ✅ **Passing** — agent produces correct Copilot SDK and BYOM output
- Invocation rate tests (4): ❌ **0% rate** — `azure-prepare` skill captures prompts first

### Local Template Support (`azd init` from local path) — ✅ Complete (separate repo)

Support for `azd init --template <local-dir>` has been implemented in the `azure-dev` CLI repo (`C:\code\azure-dev`, branch `feature/local-template-support`). This enables template development workflows where uncommitted changes need to be tested without pushing to GitHub first.

| Component | Change | Status |
|-----------|--------|--------|
| `pkg/templates/path.go` | `Absolute()` detects local dirs via `os.Stat()`, `IsLocalPath()` helper | ✅ Implemented |
| `internal/repository/initializer.go` | `copyLocalTemplate()` with `.gitignore` support, local/remote branching | ✅ Implemented |
| `cmd/init.go` | `--template` flag help text updated to mention local paths | ✅ Updated |
| `pkg/templates/path_test.go` | 13 test cases (local dirs, URLs, git URIs, edge cases) | ✅ Passing |
| `internal/repository/initializer_test.go` | 3 new tests (local copy, `.git` exclusion, `.gitignore` respect) | ✅ Passing |

**Key design decisions:**
- Uses `copy.Copy()` (not `git clone`) to preserve uncommitted/unstaged changes
- Excludes `.git/` directory from copy (destination gets fresh `git init`)
- Respects `.gitignore` rules via `go-gitignore` so `node_modules/`, `build/`, `.env` etc. are excluded
- File handle properly closed after reading `.gitignore` (fixed `gitignore.NewFromFile()` → `gitignore.New()` + `f.Close()`)

### PR Conflict Check — ✅ No conflicts

| PR | Owner | Scope | Status | Conflicts? |
|----|-------|-------|--------|------------|
| #865 | ankitbko | `plugin/skills/microsoft-foundry/agent/` | Open | ❌ None |
| #914 | kuojianlu | `plugin/skills/agent-framework/` (draft) | Open | ❌ None |
| #915 | anchenyi | `plugin/skills/agent-framework/` (draft) | Open | ❌ None |
| #938 | JasonYeMSFT | `.github/workflows/` | ✅ Merged | N/A |

### What Changed in This PR (Summary)

**Removed:**
- Agent/service template split (was: `copilot-sdk-agent` + `copilot-sdk-service` → now: single `copilot-sdk-service`)
- All Foundry agent references (AIProjectClient, threads, function tools, evaluation, `host: azure.ai.agent`)
- `foundry agent`, `copilot agent` trigger phrases
- P1 (Agent Template Hosting) and P2 (Foundry Hosting) roadmap items

**Added:**
- Three model paths: GitHub default → GitHub specific → Azure BYOM
- `DO NOT USE FOR: Foundry agent hosting (use microsoft-foundry skill)`
- Chat endpoint with true token-level SSE streaming via `assistant.message_delta` events
- `model-config.ts` shared module with per-request token refresh for Azure BYOM
- Conditional Azure OpenAI Bicep resources for BYOM
- Additional SDK-specific trigger phrases (`@github/copilot-sdk`, `CopilotClient`, `createSession`, etc.)
- Local template support in `azd init` for template development workflows (separate `azure-dev` repo)

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

### P1 — Additional Language Templates

Current template is TypeScript/Express only. Future templates for Python (FastAPI), Go, and .NET.

### P2 — Plugin-Side Template Source Configuration

Add ability for the `azure-hosted-copilot-sdk` skill to reference local template directories (using the `azd init --template <local-dir>` support added in the `azure-dev` CLI). This would enable the skill to point at a local template checkout during development instead of always pulling from `azure-samples/copilot-sdk-service`.

## Known Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Skill rarely invoked by agent (0% invocation rate) | Users don't get skill-specific guidance; `azure-prepare` captures prompts first | **High** |
| PR #880 title is stale ("Add Copilot SDK azure agent Skill") | Doesn't reflect rename to `azure-hosted-copilot-sdk` or scope changes | Low |
| `listModels()` doesn't return Azure deployments | Users must use CLI to discover deployment names | Low |
| PR #938 already merged | Conflict check table entry is now historical | Info |

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
├── integration.test.ts                         # 6 integration tests (4 invocation rate + 2 content)
├── triggers.test.ts                            # 23 trigger matching tests
├── unit.test.ts                                # 17 unit tests
└── __snapshots__/triggers.test.ts.snap         # Trigger keyword snapshots

tests/utils/
└── regression-detectors.ts                     # countApiKeyInByomConfig() detector

# Related: azure-dev CLI local template support
# Branch: feature/local-template-support in C:\code\azure-dev
cli/azd/pkg/templates/path.go                   # Absolute() + IsLocalPath()
cli/azd/pkg/templates/path_test.go              # 13 test cases
cli/azd/internal/repository/initializer.go      # copyLocalTemplate() with .gitignore
cli/azd/internal/repository/initializer_test.go # 3 local template tests
cli/azd/cmd/init.go                             # Updated --template help text
```
