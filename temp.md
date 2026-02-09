# GHCP SDK → Azure Deploy Test Scenarios

## Context

Build momentum on apps people build with the GitHub Copilot SDK and get them deployed end-to-end in Azure. The current experience has too much impedance mismatch — no simple paved path to build/deploy/manage. These scenarios explicitly test the "Deploy my GHCP SDK app to Azure" flow, including dependency plumbing.

---

## Scenario 1: `ghcp-sdk-deploy` — Deploy to Azure Compute (Web App / Container Apps)

**File:** `scenarios/ghcp-sdk-deploy.yaml`

**What it tests:** Taking a Copilot Extension built with `@copilot-extensions/preview-sdk` (Node.js/Express, SSE streaming) and deploying it to Azure compute with all dependencies wired up.

### Prompt Flow

| # | Prompt | What it exercises | Success criteria |
|---|--------|-------------------|------------------|
| 1 | Deploy a Copilot SDK Express app to Azure — pick Web App vs Container Apps and set it up end to end | Hosting decision, initial `azure.yaml` + Bicep scaffolding, first `azd up` | `azure.yaml`, `infra/main.bicep`, `package.json` exist; deployed; endpoint responds |
| 2 | Configure GITHUB_TOKEN via Key Vault, set COPILOT_AGENT_URL to the public endpoint, add a `/health` endpoint | Secrets management, env var wiring, health check plumbing | `infra/main.bicep` exists; deployed; endpoint responds |
| 3 | Add Azure AI Foundry OpenAI backend (GPT-4o) with managed identity | Multi-service wiring, managed identity auth, Foundry integration | `infra/main.bicep` exists; deployed |

### Regression Detectors

| Name | What it catches | Max allowed |
|------|----------------|-------------|
| secrets in code | Hardcoded tokens/keys in source | 0 |
| ACR auth spiral | Container registry credential loops | 3 |
| port binding confusion | WEBSITES_PORT / port mismatch issues | 2 |
| Web App vs ACA thrashing | Flip-flopping between hosting choices | 2 |
| managed identity failure | DefaultAzureCredential errors | 2 |
| SSE streaming broken | Proxy buffering breaking SSE | 1 |

### Verification

- `GET /health` → 200, body contains "ok"
- `POST /agent` endpoint exists (returns 405 on GET, confirming route is registered)

### Scoring Limits

- 35 min max duration, 55 turns, 6 `azd up` attempts, 8 Bicep edits
- Must invoke: `avm-bicep-rules`, `azure-prepare`

---

## Scenario 2: `ghcp-sdk-foundry-agent` — Deploy to Foundry Hosted Agents

**File:** `scenarios/ghcp-sdk-foundry-agent.yaml`

**What it tests:** Deploying the same Copilot SDK agent as a Foundry hosted agent (no self-managed compute), wiring AI services, adding tools, and bridging back to GitHub as a Copilot Extension.

### Prompt Flow

| # | Prompt | What it exercises | Success criteria |
|---|--------|-------------------|------------------|
| 1 | Deploy Copilot SDK agent as a hosted agent in Azure AI Foundry | Foundry project setup, agent config, managed runtime | `azure.yaml`, `infra/main.bicep` exist; deployed |
| 2 | Add GPT-4o model + AI Search index as connected resources, use managed identity | Model deployment, search index wiring, identity auth | `infra/main.bicep` exists; deployed |
| 3 | Add code interpreter + file search tools, configure system prompt | Foundry agent tools, prompt engineering | deployed |
| 4 | Bridge between GitHub Copilot Extension webhook format and Foundry agent API | Webhook format translation, SSE bridge, deploy alongside agent | `azure.yaml` exists; deployed; endpoint responds |

### Regression Detectors

| Name | What it catches | Max allowed |
|------|----------------|-------------|
| secrets in code | Hardcoded tokens/keys in source | 0 |
| Foundry vs OpenAI confusion | Bypassing Foundry for raw OpenAI | 1 |
| model deployment missing | GPT-4o deployment not found | 2 |
| AI Search connection failure | Search index / grounding errors | 2 |
| managed identity failure | DefaultAzureCredential errors | 2 |
| agent API format mismatch | Webhook / SSE format translation errors | 2 |
| Foundry SDK version confusion | Wrong SDK imports / missing packages | 2 |

### Verification

- `GET /health` → 200, body contains "ok"

### Scoring Limits

- 40 min max duration, 60 turns, 7 `azd up` attempts, 10 Bicep edits
- Must invoke: `avm-bicep-rules`, `azure-prepare`

---

## How the Two Scenarios Relate

```
Scenario 1 (ghcp-sdk-deploy)          Scenario 2 (ghcp-sdk-foundry-agent)
─────────────────────────────          ────────────────────────────────────
Copilot SDK app                        Copilot SDK app
    │                                      │
    ▼                                      ▼
Azure Compute                          Azure AI Foundry
(Web App or Container Apps)            (Hosted Agent runtime)
    │                                      │
    ├── Key Vault (secrets)                ├── GPT-4o model deployment
    ├── Health check                       ├── AI Search (grounding)
    └── Azure OpenAI (Foundry)             ├── Code interpreter + file search tools
                                           └── Webhook bridge → GitHub Extension
```

**Scenario 1** = "I want to run my own compute and wire things up"
**Scenario 2** = "I want Foundry to host my agent and I bridge it back to GitHub"

Both test the core pain point: **there's no simple paved path from "I built a GHCP SDK app" to "it's running in Azure"**.

---

## Spike Plan (Monday)

1. Run `ghcp-sdk-deploy` scenario first — it's the simpler/more immediate path
2. Note where the flow breaks (hosting decision, secrets, port binding, SSE streaming)
3. Run `ghcp-sdk-foundry-agent` scenario — the more ambitious Foundry-hosted path
4. Note where Foundry abstractions help vs. add confusion
5. Document gaps in skills/MCP server coverage for both paths
