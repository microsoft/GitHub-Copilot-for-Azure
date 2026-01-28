---
name: microsoft-foundry
description: >-
  Microsoft Foundry is the unified AI platform for building, deploying, and managing AI assets.
  Use this skill for: (1) Deploying AI models from the model catalog (OpenAI, Meta, Microsoft),
  (2) Creating AI agents with tools (web search, functions, file search), (3) Building RAG applications
  with knowledge indexes, (4) Evaluating agent performance and safety, (5) Monitoring AI assets in production.
  Trigger phrases: "create a model", "deploy a model", "create an agent", "build an AI agent",
  "RAG application", "knowledge index", "evaluate my agent", "AI observability", "model catalog",
  "deploy GPT-4", "create AI assistant", "agent evaluation", "AI monitoring".
metadata:
  author: microsoft
  version: "2.0"
compatibility: Requires Azure CLI (az) and optionally Azure Developer CLI (azd)
---

# Microsoft Foundry

**The unified AI platform for models, agents, and AI applications.**

Microsoft Foundry enables you to discover and deploy AI models, create intelligent agents with tools, build RAG applications, and evaluate AI performance—all in one platform.

## When to Use This Skill

| Category | Triggers |
|----------|----------|
| **Models** | "create a model", "deploy a model", "model catalog", "deploy GPT-4", "list models" |
| **Agents** | "create an agent", "build AI agent", "AI assistant", "agent with tools" |
| **RAG** | "RAG application", "knowledge index", "document search", "grounded AI" |
| **Evaluation** | "evaluate agent", "agent quality", "AI safety", "test my agent" |
| **Observability** | "AI monitoring", "agent metrics", "production monitoring" |

---

## Quick Start

### 1. Discover Models

```bash
# List Foundry resources
az resource list --resource-type "Microsoft.CognitiveServices/accounts" \
  --query "[?kind=='AIServices'].{Name:name, RG:resourceGroup}" -o table
```

**MCP Tools:**
- `foundry_models_list` - Browse model catalog
- `foundry_models_list(search-for-free-playground=true)` - Free playground models
- `foundry_models_list(publisher="OpenAI")` - Filter by publisher

### 2. Deploy a Model

```bash
az cognitiveservices account deployment create \
  --name <foundry-resource> --resource-group <rg> \
  --deployment-name gpt-4o-deployment \
  --model-name gpt-4o --model-version "2024-05-13" \
  --model-format OpenAI --sku-name Standard --sku-capacity 10
```

**MCP Tool:** `foundry_models_deploy`

### 3. Create an Agent

**MCP Tools:**
- `foundry_agents_list` - List existing agents
- Create agents via SDK - See [language/python.md](language/python.md#basic-agent)

### 4. Evaluate Agent

**MCP Tools:**
- `foundry_agents_query_and_evaluate` - Query and evaluate in one call
- `foundry_agents_evaluate` - Evaluate existing response

---

## Core Capabilities

### Models
- **Model Catalog**: Discover models from OpenAI, Meta, Microsoft, and more
- **Free Playground**: Prototype without costs on supported models
- **Deployment**: Deploy models with configurable capacity and SKU
- **MCP Tools**: `foundry_models_list`, `foundry_models_deploy`, `foundry_models_deployments_list`

### Agents
- **Tools**: Web search, Azure AI Search, custom functions, file search
- **Conversations**: Thread-based interactions with context
- **Best Practices**: Clear instructions, proper tool selection, cleanup
- **MCP Tools**: `foundry_agents_list`, `foundry_agents_connect`

### RAG Applications
- **Knowledge Indexes**: Vector search, hybrid search, semantic search
- **Azure AI Search Integration**: Production-ready retrieval
- **Citations**: Grounded responses with source attribution
- **MCP Tools**: `foundry_knowledge_index_list`, `foundry_knowledge_index_schema`

### Evaluation & Observability
- **Built-in Evaluators**: Intent resolution, task adherence, tool call accuracy
- **Batch Evaluation**: Evaluate multiple conversations
- **Continuous Monitoring**: Production agent performance tracking
- **MCP Tools**: `foundry_agents_query_and_evaluate`, `foundry_agents_evaluate`

---

## MCP Tools Reference

| Tool | Purpose |
|------|---------|
| `foundry_resource_get` | Get resource details and endpoint |
| `foundry_models_list` | Browse model catalog |
| `foundry_models_deploy` | Deploy a model |
| `foundry_models_deployments_list` | List deployed models |
| `foundry_knowledge_index_list` | List knowledge indexes |
| `foundry_knowledge_index_schema` | Get index schema |
| `foundry_agents_list` | List agents |
| `foundry_agents_connect` | Query an agent |
| `foundry_agents_query_and_evaluate` | Query and evaluate |
| `foundry_openai_chat_completions_create` | Chat completions |
| `foundry_openai_embeddings_create` | Create embeddings |

---

## Detailed Guides

For step-by-step workflows and SDK examples:

- **[Detailed Workflows](references/workflows.md)** - Model deployment, RAG, agents, evaluation
- **[Python SDK Guide](language/python.md)** - Authentication, agents, RAG, evaluation
- **[Model Deployment](references/workflows.md#model-discovery-and-deployment)** - Deploy and configure models
- **[Agent Creation](references/workflows.md#creating-ai-agents)** - Create agents with tools
- **[RAG Applications](references/workflows.md#building-rag-applications)** - Knowledge indexes and search
- **[Evaluation](references/workflows.md#evaluating-agent-performance)** - Agent quality assessment

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deployment pending/fails | Check quota, try different region |
| No citations in RAG | Update agent instructions to request citations |
| 401/403 auth error | Assign RBAC roles (Search Index Data Contributor) |
| Rate limit (429) | Implement retry logic, request quota increase |
| Evaluation shows no data | Generate traffic, expand time range, wait for ingestion |

---

## Resources

- [Microsoft Foundry Docs](https://learn.microsoft.com/azure/ai-foundry/)
- [Foundry Quickstart](https://learn.microsoft.com/azure/ai-foundry/quickstarts/get-started-code)
- [Agent Evaluation Guide](https://learn.microsoft.com/azure/ai-foundry/how-to/develop/agent-evaluate-sdk)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
