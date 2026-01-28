# Microsoft Foundry Detailed Workflows

This document contains step-by-step workflows for common Microsoft Foundry tasks.

## Table of Contents

- [Model Discovery and Deployment](#model-discovery-and-deployment)
- [Building RAG Applications](#building-rag-applications)
- [Creating AI Agents](#creating-ai-agents)
- [Evaluating Agent Performance](#evaluating-agent-performance)
- [Troubleshooting](#troubleshooting)

---

## Model Discovery and Deployment

### Step 1: List Available Resources

```bash
# List all Microsoft Foundry resources in subscription
az resource list \
  --resource-type "Microsoft.CognitiveServices/accounts" \
  --query "[?kind=='AIServices'].{Name:name, ResourceGroup:resourceGroup, Location:location}" \
  --output table

# List resources in a specific resource group
az resource list \
  --resource-group <resource-group-name> \
  --resource-type "Microsoft.CognitiveServices/accounts" \
  --output table
```

**MCP Tool:** `foundry_resource_get`

### Step 2: Browse Model Catalog

**Key Points:**
- Some models support **free playground** for prototyping without costs
- Models can be filtered by **publisher** (OpenAI, Meta, Microsoft)
- Models can be filtered by **license type**
- Model availability varies by region

**MCP Tool Examples:**
- List all models: `foundry_models_list()`
- Free playground models: `foundry_models_list(search-for-free-playground=true)`
- Filter by publisher: `foundry_models_list(publisher="OpenAI")`
- Filter by license: `foundry_models_list(license="MIT")`

### Step 3: Deploy a Model

```bash
# Deploy a model (e.g., gpt-4o)
az cognitiveservices account deployment create \
  --name <foundry-resource-name> \
  --resource-group <resource-group-name> \
  --deployment-name gpt-4o-deployment \
  --model-name gpt-4o \
  --model-version "2024-05-13" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name Standard

# Verify deployment status
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group-name> \
  --deployment-name gpt-4o-deployment
```

**MCP Tool:** `foundry_models_deploy` with parameters:
- `resource-group`: Resource group name
- `deployment`: Deployment name
- `model-name`: Model to deploy (e.g., "gpt-4o")
- `model-format`: Format (e.g., "OpenAI")
- `azure-ai-services`: Foundry resource name
- `model-version`: Specific version
- `sku-capacity`: Capacity units
- `scale-type`: Scaling type

**Deployment Verification:**
When deployment completes, `provisioningState` should be `Succeeded`. Common failure causes:
- Insufficient quota
- Region capacity limitations
- Permission issues

### Step 4: Get Resource Endpoint

**MCP Tool:** `foundry_resource_get`

**Expected Output:**
Endpoint format: `https://<resource>.services.ai.azure.com/api/projects/<project-name>`

---

## Building RAG Applications

### Understanding RAG

RAG (Retrieval-Augmented Generation) enhances AI responses by:
1. **Retrieving** relevant documents from a knowledge base
2. **Augmenting** the AI prompt with retrieved context
3. **Generating** responses grounded in factual information

### Step 1: List Knowledge Indexes

**MCP Tool:** `foundry_knowledge_index_list` with your project endpoint

### Step 2: Inspect Index Schema

**MCP Tool:** `foundry_knowledge_index_schema` with project endpoint and index name

**Schema Information:**
- Field definitions and data types
- Searchable attributes
- Vectorization configuration
- Retrieval mode support (keyword, semantic, vector, hybrid)

### Step 3: Create RAG Agent

To create a RAG agent with Azure AI Search:

1. **Initialize AI Project Client** with endpoint and credentials
2. **Get Azure AI Search connection** from project
3. **Create agent** with:
   - Agent name and model deployment
   - Clear instructions requesting citations
   - Azure AI Search tool with connection ID, index name, query type

**For SDK Implementation:** See [../language/python.md](../language/python.md#rag-applications-with-python-sdk)

**Best Practices:**
- **Always request citations** in agent instructions
- Use **hybrid search** for best results
- Instruct agent to say "I don't know" when info isn't in index
- Format citations consistently

### Step 4: Test RAG Agent

1. Query the agent with a test question
2. Stream the response for real-time output
3. Capture citations from response annotations
4. Validate citation formatting

**For SDK Implementation:** See [../language/python.md](../language/python.md#testing-the-rag-agent)

---

## Creating AI Agents

### Step 1: List Existing Agents

**MCP Tool:** `foundry_agents_list` with project endpoint

### Step 2: Create Basic Agent

Create with:
- **Model deployment name**: The model to use
- **Agent name**: Unique identifier
- **Instructions**: Clear, specific guidance

**For SDK Implementation:** See [../language/python.md](../language/python.md#basic-agent)

### Step 3: Add Custom Function Tools

1. Define custom functions with clear docstrings
2. Create function toolset with custom functions
3. Create agent with toolset and instructions

**For SDK Implementation:** See [../language/python.md](../language/python.md#agent-with-custom-function-tools)

### Step 4: Add Web Search

Create agent with web search capabilities:
- Optionally specify user location for localized results
- Provide instructions to always cite web sources

**For SDK Implementation:** See [../language/python.md](../language/python.md#agent-with-web-search)

### Step 5: Interact with Agent

1. Create conversation thread
2. Add user messages
3. Run agent to process messages
4. Check run status
5. Retrieve messages
6. Cleanup (delete agent when done)

**For SDK Implementation:** See [../language/python.md](../language/python.md#interacting-with-agents)

### Agent Best Practices

1. **Clear Instructions**: Specific, actionable guidance
2. **Tool Selection**: Only include needed tools
3. **Error Handling**: Check `run.status` for failures
4. **Cleanup**: Delete agents/threads to manage costs
5. **Rate Limits**: Handle 429 errors gracefully

---

## Evaluating Agent Performance

### Built-in Evaluators

| Evaluator | What It Measures | Score |
|-----------|------------------|-------|
| `IntentResolutionEvaluator` | User request understanding | 1-5 |
| `TaskAdherenceEvaluator` | Adherence to tasks/instructions | 1-5 |
| `ToolCallAccuracyEvaluator` | Correct function tool calls | 1-5 |

**Evaluation Output:**
- `{metric_name}`: Numerical score (1-5)
- `{metric_name}_result`: "pass" or "fail"
- `{metric_name}_threshold`: Binarization threshold
- `{metric_name}_reason`: Explanation

### Single Run Evaluation

**MCP Tool:** `foundry_agents_query_and_evaluate`

Parameters:
- Agent ID
- Query text
- Project endpoint
- Azure OpenAI endpoint and deployment
- Comma-separated evaluators

### Evaluate Existing Response

**MCP Tool:** `foundry_agents_evaluate`

### Batch Evaluation

1. Convert agent thread data to evaluation format
2. Prepare data from multiple thread IDs
3. Set up evaluators
4. Run batch evaluation

**For SDK Implementation:** See [../language/python.md](../language/python.md#batch-evaluation)

### Score Interpretation

| Score | Meaning |
|-------|---------|
| 5 | Excellent - Perfect understanding and execution |
| 4 | Good - Minor issues, overall successful |
| 3 | Acceptable - Threshold for passing |
| 2 | Poor - Significant issues |
| 1 | Failed - Complete misunderstanding |

---

## Troubleshooting

### Deployment Issues

**Problem: Deployment Pending/Fails**

```bash
# Check deployment status
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --output json

# Check quota
az cognitiveservices account show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --query "properties.quotaLimit"
```

**Resolution:**
1. Check quota limits in Azure Portal
2. Request quota increase
3. Try different region
4. Verify RBAC permissions

### Agent Issues

**No Citations in RAG Response:**
- Update instructions to explicitly request citations
- Verify tool choice is "required" or "auto"
- Check Azure AI Search connection

**Index Not Found:**
- Verify `AI_SEARCH_INDEX_NAME` matches actual index
- Check connection points to correct resource
- Ensure index is created and populated

**401/403 Authentication:**

```bash
# Assign role to managed identity
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Search Index Data Contributor" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Search/searchServices/<service>
```

### Evaluation Issues

**Dashboard Shows No Data:**
1. Generate new agent traffic
2. Expand time range filter
3. Wait for data ingestion
4. Refresh dashboard

**Continuous Evaluation Not Running:**
1. Verify evaluation rule is enabled
2. Confirm agent traffic is flowing
3. Check managed identity has **Azure AI User** role
4. Verify OpenAI endpoint is accessible

### Rate Limiting

**Error:** `Rate limit is exceeded` (HTTP 429)

```bash
# Check quota usage
az cognitiveservices usage list \
  --name <resource-name> \
  --resource-group <resource-group>
```

**Best Practices:**
- Implement exponential backoff
- Use Dynamic Quota when available
- Monitor usage proactively
- Consider multi-region deployments

---

## Environment Variables

```bash
# Foundry Project
PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
MODEL_DEPLOYMENT_NAME=gpt-4o

# Azure AI Search (for RAG)
AZURE_AI_SEARCH_CONNECTION_NAME=my-search-connection
AI_SEARCH_INDEX_NAME=my-index

# Evaluation
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```
