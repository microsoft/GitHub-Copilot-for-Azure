# Copilot SDK Skill Comparison

**microsoft/skills `copilot-sdk`** vs **this repo `azure-hosted-copilot-sdk`**

## Summary

| Dimension | microsoft/skills `copilot-sdk` | This repo `azure-hosted-copilot-sdk` |
|-----------|-------------------------------|--------------------------------------|
| **Skill name** | `copilot-sdk` | `azure-hosted-copilot-sdk` |
| **Focus** | SDK API reference — how to *use* the SDK across 4 languages | Azure hosting — how to *build, deploy, and host* a Copilot SDK app on Azure |
| **Languages covered** | Node.js, Python, Go, .NET | Node.js/TypeScript only (template-driven) |
| **Azure content** | BYOK provider config only (no infra, no deploy) | Full Azure lifecycle: scaffold → Bicep → Container Apps → Key Vault → deploy |
| **Template** | None | `azure-samples/copilot-sdk-service` (Express + React + Bicep + Dockerfiles) |
| **Deployment guidance** | None | `azure-prepare` → `azure-validate` → `azure-deploy` chain |
| **Infrastructure as Code** | None | AVM Bicep modules, Key Vault, Managed Identity, conditional Azure OpenAI |
| **Token/auth in prod** | Mentions env vars and BYOK config | Full Key Vault flow: `gh auth token` → azd hook → Bicep `@secure()` → KV secret → Container App env |
| **File count** | 1 (`SKILL.md`, ~15 KB) | 5 files (`SKILL.md` + 4 references, ~12 KB total) |
| **Reference files** | None | `copilot-sdk.md`, `azure-model-config.md`, `deploy-existing.md`, `existing-project-integration.md` |
| **Token budget** | ~4,000 tokens (single large file) | ~500 tokens SKILL.md + ~1,000 tokens per ref (progressive disclosure) |
| **Test suite** | Not visible in repo | 46 tests: 23 trigger, 17 unit, 6 integration |

---

## Feature-by-Feature Comparison

### SDK API Coverage

| Feature | microsoft/skills | This repo | Gap |
|---------|-----------------|-----------|-----|
| Core pattern (Client → Session → Message) | ✅ 4 languages | ✅ Node.js only | This repo covers 1/4 languages |
| Streaming (`assistant.message_delta`) | ✅ Node.js + Python | ✅ Node.js (SSE endpoint) | microsoft/skills has Python streaming too |
| Custom tools (`defineTool`) | ✅ 4 languages | ❌ Not covered | **Gap** — this repo assumes template tools |
| Hooks (pre/post tool, prompt, session) | ✅ Full table + examples | ❌ Not covered | **Gap** — significant SDK feature missing |
| MCP server integration | ✅ Remote HTTP + Local stdio | ❌ Not covered | **Gap** — no MCP guidance |
| Session persistence / resume | ✅ `sessionId`, `resumeSession`, `listSessions` | ❌ Not covered | **Gap** |
| Infinite sessions (auto-compaction) | ✅ Config example | ❌ Not covered | **Gap** |
| Custom agents (in-session) | ✅ `customAgents` config | ❌ Not covered | **Gap** |
| System message | ✅ Example | ❌ Not covered | **Gap** |
| Skills integration (`skillDirectories`) | ✅ Example | ❌ Not covered | **Gap** |
| Permission / input handlers | ✅ `onPermissionRequest`, `onUserInputRequest` | ❌ Not covered | **Gap** |
| External CLI server (`--headless`) | ✅ Example | ❌ Not covered | **Gap** |
| Client configuration table | ✅ 8 options documented | ❌ Not covered | **Gap** |
| Session configuration table | ✅ 17 options documented | ❌ Not covered | **Gap** |
| Debugging guide | ✅ Common issues table | ✅ Error tables in each ref | Parity |
| `listModels()` | ❌ Not mentioned | ✅ Documented for model discovery | This repo ahead |

### Authentication

| Feature | microsoft/skills | This repo | Gap |
|---------|-----------------|-----------|-----|
| Auth priority chain (token → env → OAuth → gh) | ✅ Documented | ❌ Not explicit | **Gap** |
| Programmatic token | ✅ `githubToken` in constructor | ✅ `GITHUB_TOKEN` env var | Parity (different angle) |
| BYOK / BYOM config | ✅ `provider` config with `apiKey` | ✅ `provider` config with `bearerToken` + `DefaultAzureCredential` | This repo is Azure-specific and deeper |
| Provider types table | ✅ OpenAI, Azure, Anthropic, Ollama | ✅ Azure OpenAI, Azure AI Foundry | microsoft/skills broader, this repo deeper on Azure |
| Wire API (`responses` vs `completions`) | ✅ Documented | ❌ Not mentioned | **Gap** |
| Token refresh in production | ❌ Not covered | ✅ Per-request `DefaultAzureCredential` refresh pattern | **This repo ahead** |
| Key Vault secret flow | ❌ Not covered | ✅ Full flow: gh → azd hook → Bicep → KV → Container App | **This repo ahead** |

### Azure Hosting & Deployment

| Feature | microsoft/skills | This repo | Gap |
|---------|-----------------|-----------|-----|
| Template scaffolding | ❌ None | ✅ `azd init --template azure-samples/copilot-sdk-service` | **This repo ahead** |
| Bicep infrastructure | ❌ None | ✅ AVM modules: monitoring, identity, Key Vault, Container Apps | **This repo ahead** |
| Dockerfile guidance | ❌ None | ✅ Read template Dockerfile, adapt to user project | **This repo ahead** |
| `azure.yaml` structure | ❌ None | ✅ Hooks, services, multi-app config | **This repo ahead** |
| Deploy chain | ❌ None | ✅ `azure-prepare` → `azure-validate` → `azure-deploy` | **This repo ahead** |
| Conditional BYOM infra | ❌ None | ✅ `useAzureModel` param toggles Azure OpenAI + role assignment | **This repo ahead** |
| GitHub token flow (prod) | ❌ None | ✅ `scripts/get-github-token.mjs` → Key Vault → Managed Identity | **This repo ahead** |
| Existing project integration | ❌ None | ✅ Detect project type, add SDK dependency, wire routes | **This repo ahead** |

### Skill Architecture

| Aspect | microsoft/skills | This repo |
|--------|-----------------|-----------|
| Structure | Monolithic 15 KB SKILL.md, no references | Modular: 500-token SKILL.md + 4 reference files |
| Progressive disclosure | ❌ Entire file loads at once | ✅ Frontmatter → SKILL.md → refs on demand |
| Token efficiency | ~4,000 tokens per activation | ~500 tokens initially, ~1,000 per ref as needed |
| Routing logic | None (pure reference doc) | Step 1 routing table: scaffold / deploy / integrate / model config |
| MCP tool usage | None | ✅ `github-mcp-server-get_file_contents`, `context7-*` |
| Skill chaining | None | ✅ Chains to `azure-prepare`, `azure-validate`, `azure-deploy` |
| Anti-triggers (DO NOT USE FOR) | None | ✅ Excludes Copilot Extensions, Foundry agents, general web apps |

---

## Overlap Analysis

### What both skills cover (potential duplication)

1. **Core SDK pattern** — Client → Session → Message in Node.js/TypeScript
2. **BYOK/BYOM provider config** — Both document `provider` object with `type`, `baseUrl`
3. **Streaming** — Both show `assistant.message_delta` event subscription
4. **Package installation** — Both list `@github/copilot-sdk` as the Node.js package
5. **SDK documentation links** — Both point to `github.com/github/copilot-sdk`

### What only microsoft/skills covers

1. Python, Go, .NET SDK examples
2. Custom tools (`defineTool`) across all 4 languages
3. Hooks system (6 hook types with permission control)
4. MCP server integration (remote HTTP + local stdio)
5. Session persistence and resumption
6. Infinite sessions with auto-compaction
7. Custom agents and system messages
8. Skills integration (`skillDirectories`)
9. Permission and input handlers
10. External CLI server mode (`--headless`)
11. Full client/session configuration reference tables
12. Auth priority chain documentation
13. Non-Azure BYOK providers (Anthropic, Ollama)

### What only this repo covers

1. Azure Container Apps deployment end-to-end
2. AVM Bicep infrastructure modules
3. Key Vault GitHub token secret flow
4. `azure.yaml` hooks and service configuration
5. Template scaffolding with `azd init`
6. Conditional BYOM infrastructure (Azure OpenAI + role assignment)
7. Per-request `DefaultAzureCredential` token refresh pattern
8. Existing project integration workflow (detect → add SDK → wire routes)
9. Deploy chain orchestration (prepare → validate → deploy)
10. Agent routing logic (skill chaining)
11. Progressive disclosure architecture
12. Test suite (46 tests)

---

## Complementary Nature

The two skills are **complementary, not duplicative**. They address different stages of the developer journey:

```
Developer Journey
─────────────────
                    microsoft/skills              This repo
                    copilot-sdk                   azure-hosted-copilot-sdk
                    ─────────────                 ────────────────────────
"How do I use      ████████████████              ██ (Node.js only)
 the SDK API?"

"How do I add      ████████████████              ████████████████
 custom tools?"    (4 languages)                 (not covered)

"How do I host     ░░░░░░░░░░░░░░░░              ████████████████
 on Azure?"        (not covered)                 (full lifecycle)

"How do I          ░░░░░░░░░░░░░░░░              ████████████████
 deploy to prod?"  (not covered)                 (Container Apps + KV)

"How do I use      ██████████                    ████████████████
 my own model?"    (BYOK config)                 (BYOM + Azure infra)
```

### Recommendation

| Action | Rationale |
|--------|-----------|
| **Keep both skills** | They solve different problems — SDK API usage vs Azure hosting |
| **Remove SDK API overlap from this repo** | Defer `Client → Session → Message` basics to microsoft/skills; keep only Azure-specific patterns |
| **Add cross-references** | This repo should say "For SDK API reference, see microsoft/skills `copilot-sdk`" |
| **Consider contributing Azure content upstream** | The Azure hosting workflow could become a `-ts` suffix skill in microsoft/skills |
| **Backfill hooks/tools/MCP in this repo** | If users scaffold via this skill, they'll need hooks and MCP — currently a gap |

---

## Token Budget Comparison

| Metric | microsoft/skills | This repo |
|--------|-----------------|-----------|
| SKILL.md size | ~15,050 bytes (~4,000 tokens) | ~1,400 bytes (~500 tokens) |
| Reference files | 0 | 4 files (~3,500 tokens total) |
| Total if fully loaded | ~4,000 tokens | ~4,000 tokens |
| Initial activation cost | ~4,000 tokens (all at once) | ~500 tokens (SKILL.md only) |
| Exceeds 500-token SKILL.md limit? | ❌ **Yes** (~8× over) | ✅ **No** (within limit) |
| Exceeds 1,000-token ref limit? | N/A | ✅ Each ref within limit |

> ⚠️ The microsoft/skills `copilot-sdk` SKILL.md is approximately 15 KB / ~4,000 tokens — significantly exceeding the 500-token SKILL.md guideline used in this repo. This means the entire SDK reference loads into context on every activation, regardless of whether the user needs all sections.
