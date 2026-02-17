# azure-hosted-github-sdk — Feature Status

## Overview

The `azure-hosted-github-sdk` skill enables users to build, deploy, and configure GitHub Copilot SDK applications on Azure. It covers three core workflows: scaffolding new apps from templates, deploying existing SDK apps, and configuring Bring Your Own Model (BYOM) to use Azure AI Foundry or Azure OpenAI models instead of the default GitHub-hosted models.

## Current Status

### Skill Files — ✅ Complete

| File | Purpose | Status |
|------|---------|--------|
| `plugin/skills/azure-hosted-github-sdk/SKILL.md` | Main routing logic (Steps 1→2A/2B/2C→3) | ✅ Done (~471/500 tokens) |
| `references/copilot-sdk.md` | SDK architecture, session lifecycle, BYOM comparison | ✅ Done (~888/1000 tokens) |
| `references/deploy-existing.md` | Deploy workflow, Bicep infra, BYOM infrastructure | ✅ Done (~640/1000 tokens) |
| `references/existing-project-integration.md` | Add SDK to existing apps, BYOM integration guide | ✅ Done (~844/1000 tokens) |
| `references/azure-model-config.md` | BYOM provider config, DefaultAzureCredential, errors | ✅ New (~445/1000 tokens) |

### Template Repos — ✅ Agent done, ⚠️ Service PR pending

| Repo | BYOM Support | Status |
|------|-------------|--------|
| `jongio/copilot-sdk-agent` | DefaultAzureCredential in `chat.ts`, AI Services Bicep | ✅ Already has BYOM |
| `jongio/copilot-sdk-service` | Added `@azure/identity`, provider config, AI Services Bicep | ⚠️ PR #3 open — pending review |

### Test Automation — ✅ Tests written, ⚠️ Skill routing issue

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/azure-hosted-github-sdk/triggers.test.ts` | 24 tests (11 trigger, 8 negative, 5 edge) | ✅ All passing |
| `tests/azure-hosted-github-sdk/unit.test.ts` | 17 tests (metadata, content, BYOM, frontmatter) | ✅ All passing |
| `tests/azure-hosted-github-sdk/integration.test.ts` | 4 invocation rate + 2 content quality | ⚠️ See below |
| `tests/utils/regression-detectors.ts` | `countApiKeyInByomConfig()` detector | ✅ Added |

**Integration test detail:**
- Content quality tests (2): ✅ **Passing** — agent produces correct Copilot SDK and BYOM output
- Invocation rate tests (4): ❌ **0% rate** — agent routes to `azure-prepare` instead of `azure-hosted-github-sdk`

This is a skill routing/discovery issue, not a content issue. The `azure-prepare` skill's `REQUIRED FIRST STEP` instruction captures all "build + deploy" prompts before our skill is considered. See [Known Issues](#known-issues).

## Architecture

```
User prompt
  │
  ▼
┌──────────────────────────────┐
│  azure-hosted-github-sdk     │
│  Step 1: Route               │
├──────────────────────────────┤
│  Build new?    → Step 2A     │──→ azd init --template jongio/copilot-sdk-agent
│                              │──→ azd init --template jongio/copilot-sdk-service
│  Deploy existing? → Step 2B  │──→ Adapt using template infra patterns
│  Add SDK?      → Integrate   │──→ references/existing-project-integration.md
│  Use own model? → Step 2C    │──→ references/azure-model-config.md (BYOM)
├──────────────────────────────┤
│  Step 3: Deploy              │──→ azure-prepare → azure-validate → azure-deploy
└──────────────────────────────┘
```

### BYOM Model Path

```
Copilot SDK Session
  │
  ├─ Default (no provider)
  │    Routes through GitHub Copilot API
  │    Models: gpt-4o, claude-sonnet-4.5, etc. (via listModels())
  │    Billing: Copilot premium quotas
  │
  └─ BYOM (with provider config)
       Routes to user's Azure endpoint
       Auth: DefaultAzureCredential → bearerToken (static, per-request refresh)
       Model: Azure deployment name (no SDK validation)
       Endpoint types:
         ├─ Azure AI Foundry: type="openai", wireApi="responses"
         └─ Azure OpenAI:     type="azure"
```

## Plans

### P0 — Skill Routing Fix

The skill is never invoked by the Copilot CLI agent. Prompts containing "build copilot SDK app" or "BYOM" route to `azure-prepare` instead. Root cause: `azure-prepare` has a very aggressive `REQUIRED FIRST STEP` instruction that captures all deployment-related prompts.

**Options:**
1. Improve skill description to outcompete `azure-prepare` for Copilot SDK-specific prompts
2. Add cross-skill routing — have `azure-prepare` detect Copilot SDK projects and delegate to `azure-hosted-github-sdk`
3. Use `systemPrompt` in the skill to provide stronger routing hints

### P1 — Agent Template Hosting

The `copilot-sdk-agent` template (`jongio/copilot-sdk-agent`) is the primary path for building Copilot SDK agents on Azure. Current status:

| Component | Status |
|-----------|--------|
| Agent app code (TypeScript, `defineTool`, `mcpServers`) | ✅ In template |
| Azure Container Apps hosting | ✅ In template |
| Key Vault for `GITHUB_TOKEN` | ✅ In template |
| Managed Identity + RBAC | ✅ In template |
| BYOM with DefaultAzureCredential | ✅ In template (`chat.ts`) |
| AI Services Bicep (for BYOM) | ✅ In template (`resources.bicep`) |
| Multi-model switching | ❌ Not yet — hardcoded to single deployment |
| Production token refresh | ⚠️ Per-request pattern documented, not enforced |

**Planned work:**
- Add environment-based model switching (allow users to configure multiple Azure deployments)
- Add health check endpoint for Container Apps probes
- Document scaling configuration for high-throughput agent scenarios

### P2 — Foundry Hosting

Azure AI Foundry provides a managed platform for hosting AI models. Integrating Foundry hosting means users can deploy models to Foundry and connect their Copilot SDK apps without managing compute infrastructure.

| Component | Status |
|-----------|--------|
| Foundry model deployment discovery | ✅ Via `foundry_models_deployments_list` MCP tool |
| Foundry endpoint configuration | ✅ Documented in `azure-model-config.md` |
| Foundry project Bicep module | ✅ In agent template |
| Foundry-native agent hosting | ❌ Not yet — SDK runs on Container Apps, calls Foundry API |
| Foundry agent framework integration | ❌ Future — evaluate Foundry's native agent runtime vs Copilot SDK |

**Planned work:**
- Evaluate Foundry's agent hosting capabilities as an alternative to Container Apps for the compute layer
- Add a Foundry-first template variant that provisions AI Project + model deployment + Copilot SDK app in one `azd up`
- Document cost comparison: Container Apps + Foundry API calls vs Foundry-managed agent hosting

### P3 — Service Template BYOM

PR #3 on `jongio/copilot-sdk-service` adds BYOM support to the service template. Pending merge.

| File | Change |
|------|--------|
| `package.json` | Added `@azure/identity` dependency |
| `src/summarize.ts` | Added `DefaultAzureCredential` token acquisition, provider config |
| `infra/resources.bicep` | Added AI Services account + AI Project + role assignment |
| `infra/main.bicep` | Added `AZURE_AI_FOUNDRY_PROJECT_ENDPOINT` env var to Container App |

## Known Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Skill never invoked by agent (0% invocation rate) | Users don't get skill-specific guidance | **High** |
| `bearerToken` is static — no auto-refresh callback in SDK | Long-running sessions fail after ~1 hour | Medium |
| `listModels()` doesn't return Azure deployments | Users must use MCP tool or CLI to discover deployment names | Low |
| Service template PR #3 not merged | `copilot-sdk-service` lacks BYOM out of the box | Medium |

## File Inventory

```
plugin/skills/azure-hosted-github-sdk/
├── SKILL.md                                    # Main skill (routing + steps)
└── references/
    ├── azure-model-config.md                   # BYOM provider config + auth
    ├── copilot-sdk.md                          # SDK architecture + session lifecycle
    ├── deploy-existing.md                      # Deploy workflow + Bicep infra
    └── existing-project-integration.md         # Add SDK to existing apps

tests/azure-hosted-github-sdk/
├── integration.test.ts                         # 6 integration tests (invocation rate + content)
├── triggers.test.ts                            # 24 trigger matching tests
├── unit.test.ts                                # 17 unit tests
└── __snapshots__/triggers.test.ts.snap         # Trigger keyword snapshots

tests/utils/
└── regression-detectors.ts                     # countApiKeyInByomConfig() added
```
