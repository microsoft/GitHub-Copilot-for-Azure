---
name: azure-aigateway
description: >-
  Configure Azure API Management as an AI Gateway for AI models, MCP tools, and agents.
  Use this skill for: (1) AI-specific policies (semantic caching, token limits, content safety, load balancing),
  (2) Governance of AI models (cost control, usage metrics), MCP tools (rate limiting), and agents (jailbreak detection),
  (3) Adding AI backends from Azure OpenAI or AI Foundry, (4) Testing AI endpoints through the gateway.
  For deploying APIM or general API policies, use the azure-deploy skill.
  Trigger phrases: "configure my model", "configure my tool", "add Azure OpenAI backend", "add AI Foundry model",
  "semantic caching", "token limits", "content safety", "protect my AI model", "rate limit MCP", "jailbreak detection",
  "test AI gateway", "AI governance", "LLM policies", "add model to gateway", "configure AI backend".
metadata:
  author: microsoft
  version: "3.0"
compatibility: Requires Azure CLI (az) for configuration and testing
---

# Azure AI Gateway

Configure Azure API Management (APIM) as an AI Gateway for governing AI models, MCP tools, and agents.

> **To deploy APIM**, use the **azure-deploy** skill.

## When to Use This Skill

| Category | Triggers |
|----------|----------|
| **Model Governance** | "semantic caching", "token limits", "load balance AI", "track token usage" |
| **Tool Governance** | "rate limit MCP", "protect my tools", "configure my tool" |
| **Agent Governance** | "content safety", "jailbreak detection", "filter harmful content" |
| **Configuration** | "add Azure OpenAI backend", "configure my model", "add AI Foundry" |
| **Testing** | "test AI gateway", "call OpenAI through gateway" |

---

## Architecture

```
            ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
            │   Users     │  │   Agents    │  │   Apps      │
            └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                   │                │                │
                   ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Gateway (APIM)                            │
│                 Secure • Observe • Control                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Models    │  │    Tools    │  │   Agents    │              │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤              │
│  │ Token Limits│  │ Rate Limits │  │Content Safety│             │
│  │ Sem. Cache  │  │ Auth/AuthZ  │  │Jailbreak Det.│             │
│  │ Load Balance│  │ Quotas      │  │ Filtering   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
   ┌──────────┐        ┌──────────┐       ┌──────────┐
   │Azure AOAI│        │MCP Server│       │AI Agents │
   │AI Foundry│        │Tool APIs │       │ Backends │
   │Custom LLM│        │Functions │       │ Services │
   └──────────┘        └──────────┘       └──────────┘
      Models              Tools              Agents
```

---

## Quick Reference

| Policy | Purpose | Details |
|--------|---------|---------|
| `azure-openai-token-limit` | Cost control | [Model Policies](references/policies.md#token-rate-limiting) |
| `azure-openai-semantic-cache-lookup/store` | 60-80% cost savings | [Model Policies](references/policies.md#semantic-caching) |
| `azure-openai-emit-token-metric` | Observability | [Model Policies](references/policies.md#token-metrics) |
| `llm-content-safety` | Safety & compliance | [Agent Policies](references/policies.md#content-safety) |
| `rate-limit-by-key` | MCP/tool protection | [Tool Policies](references/policies.md#request-rate-limiting) |

---

## Get Gateway Details

```bash
# Get gateway URL
az apim show --name <apim-name> --resource-group <rg> --query "gatewayUrl" -o tsv

# List backends (AI models)
az apim backend list --service-name <apim-name> --resource-group <rg> \
  --query "[].{id:name, url:url}" -o table

# Get subscription key
az apim subscription keys list \
  --service-name <apim-name> --resource-group <rg> --subscription-id <sub-id>
```

---

## Test AI Endpoint

```bash
GATEWAY_URL=$(az apim show --name <apim-name> --resource-group <rg> --query "gatewayUrl" -o tsv)

curl -X POST "${GATEWAY_URL}/openai/deployments/<deployment>/chat/completions?api-version=2024-02-01" \
  -H "Content-Type: application/json" \
  -H "Ocp-Apim-Subscription-Key: <key>" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "max_tokens": 100}'
```

---

## Common Tasks

### Add AI Backend

See [references/patterns.md](references/patterns.md#pattern-1-add-ai-model-backend) for full steps.

```bash
# Discover AI resources
az cognitiveservices account list --query "[?kind=='OpenAI']" -o table

# Create backend
az apim backend create --service-name <apim> --resource-group <rg> \
  --backend-id openai-backend --protocol http --url "https://<aoai>.openai.azure.com/openai"

# Grant access (managed identity)
az role assignment create --assignee <apim-principal-id> \
  --role "Cognitive Services User" --scope <aoai-resource-id>
```

### Apply AI Governance Policy

Recommended policy order in `<inbound>`:

1. **Authentication** - Managed identity to backend
2. **Semantic Cache Lookup** - Check cache before calling AI
3. **Token Limits** - Cost control
4. **Content Safety** - Filter harmful content
5. **Backend Selection** - Load balancing
6. **Metrics** - Token usage tracking

See [references/policies.md](references/policies.md#combining-policies) for complete example.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Token limit 429 | Increase `tokens-per-minute` or add load balancing |
| No cache hits | Lower `score-threshold` to 0.7 |
| Content false positives | Increase category thresholds (5-6) |
| Backend auth 401 | Grant APIM "Cognitive Services User" role |

See [references/troubleshooting.md](references/troubleshooting.md) for details.

---

## References

- [**Detailed Policies**](references/policies.md) - Full policy examples
- [**Configuration Patterns**](references/patterns.md) - Step-by-step patterns
- [**Troubleshooting**](references/troubleshooting.md) - Common issues
- [AI-Gateway Samples](https://github.com/Azure-Samples/AI-Gateway)
- [GenAI Gateway Docs](https://learn.microsoft.com/azure/api-management/genai-gateway-capabilities)
