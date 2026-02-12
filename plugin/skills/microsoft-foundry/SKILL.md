---
name: microsoft-foundry
description: |
  Use this skill to work with Microsoft Foundry (Azure AI Foundry): deploy AI models from catalog, build RAG applications with knowledge indexes, create and evaluate AI agents.
  USE FOR: Microsoft Foundry, AI Foundry, deploy model, model catalog, RAG, knowledge index, create agent, evaluate agent, agent monitoring.
  DO NOT USE FOR: Azure Functions (use azure-functions), App Service (use azure-create-app).
---

# Microsoft Foundry Skill

This skill helps developers work with Microsoft Foundry resources, covering model discovery and deployment, RAG (Retrieval-Augmented Generation) applications, AI agent creation, evaluation workflows, and troubleshooting.

## When to Use This Skill

Use this skill when the user wants to:

- **Discover and deploy AI models** from the Microsoft Foundry catalog
- **Build RAG applications** using knowledge indexes and vector search
- **Create AI agents** with tools like Azure AI Search, web search, or custom functions
- **Evaluate agent performance** using built-in evaluators
- **Set up monitoring** and continuous evaluation for production agents
- **Troubleshoot issues** with deployments, agents, or evaluations

## Prerequisites

### Azure Resources
- An Azure subscription with an active account
- Appropriate permissions to create Microsoft Foundry resources (e.g., Azure AI Owner role)
- Resource group for organizing Foundry resources

### Tools
- **Azure CLI** installed and authenticated (`az login`)
- **Azure Developer CLI (azd)** for deployment workflows (optional but recommended)

### Language-Specific Requirements

For SDK examples and implementation details in specific programming languages, refer to:
- **Python**: See [language/python.md](language/python.md) for Python SDK setup, authentication, and examples

## Core Workflows

### 1. Getting Started - Model Discovery and Deployment

#### Use Case
A developer new to Microsoft Foundry wants to explore available models and deploy their first one.

#### Step 1: List Available Resources

First, help the user discover their Microsoft Foundry resources.

**Using Azure CLI:**

##### Bash
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

**Using MCP Tools:**

Use the `foundry_resource_get` MCP tool to get detailed information about a specific Foundry resource, or to list all resources if no name is provided.

#### Step 2: Browse Model Catalog

Help users discover available models, including information about free playground support.

**Key Points to Explain:**
- Some models support **free playground** for prototyping without costs
- Models can be filtered by **publisher** (e.g., OpenAI, Meta, Microsoft)
- Models can be filtered by **license type**
- Model availability varies by region

**Using MCP Tools:**

Use the `foundry_models_list` MCP tool:
- List all models: `foundry_models_list()`
- List free playground models: `foundry_models_list(search-for-free-playground=true)`
- Filter by publisher: `foundry_models_list(publisher="OpenAI")`
- Filter by license: `foundry_models_list(license="MIT")`

**Example Output Explanation:**
When listing models, explain to users:
- Models with free playground support can be used for prototyping at no cost
- Some models support GitHub token authentication for easy access
- Check model capabilities and pricing before production deployment

#### Step 3: Deploy a Model

Guide users through deploying a model to their Foundry resource.

**Using Azure CLI:**

##### Bash
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

**Using MCP Tools:**

Use the `foundry_models_deploy` MCP tool with parameters:
- `resource-group`: Resource group name
- `deployment`: Deployment name
- `model-name`: Model to deploy (e.g., "gpt-4o")
- `model-format`: Format (e.g., "OpenAI")
- `azure-ai-services`: Foundry resource name
- `model-version`: Specific version
- `sku-capacity`: Capacity units
- `scale-type`: Scaling type

**Deployment Verification:**
Explain that when deployment completes, `provisioningState` should be `Succeeded`. If it fails, common issues include:
- Insufficient quota
- Region capacity limitations
- Permission issues

#### Step 4: Get Resource Endpoint

Users need the project endpoint to connect their code to Foundry.

**Using MCP Tools:**

Use the `foundry_resource_get` MCP tool to retrieve resource details including the endpoint.

**Expected Output:**
The endpoint will be in format: `https://<resource>.services.ai.azure.com/api/projects/<project-name>`

Save this endpoint as it's needed for subsequent API and SDK calls.

### 2. Building RAG Applications with Knowledge Indexes

#### Use Case
A developer wants to build a Retrieval-Augmented Generation (RAG) application using their own documents.

#### Understanding RAG and Knowledge Indexes

**Explain the Concept:**
RAG enhances AI responses by:
1. **Retrieving** relevant documents from a knowledge base
2. **Augmenting** the AI prompt with retrieved context
3. **Generating** responses grounded in factual information

**Knowledge Index Benefits:**
- Supports keyword, semantic, vector, and hybrid search
- Enables efficient retrieval of relevant content
- Stores metadata for better citations (document titles, URLs, file names)
- Integrates with Azure AI Search for production scenarios

#### Step 1: List Existing Knowledge Indexes

**Using MCP Tools:**

Use `foundry_knowledge_index_list` with your project endpoint to list knowledge indexes.

#### Step 2: Inspect Index Schema

Understanding the index structure helps optimize queries.

**Using MCP Tools:**

Use the `foundry_knowledge_index_schema` MCP tool with your project endpoint and index name to get detailed schema information.

**Schema Information Includes:**
- Field definitions and data types
- Searchable attributes
- Vectorization configuration
- Retrieval mode support (keyword, semantic, vector, hybrid)

#### Step 3: Create an Agent with Azure AI Search Tool

**Implementation:**

To create a RAG agent with Azure AI Search tool integration:

1. **Initialize the AI Project Client** with your project endpoint and credentials
2. **Get the Azure AI Search connection** from your project
3. **Create the agent** with:
   - Agent name
   - Model deployment
   - Clear instructions (see best practices below)
   - Azure AI Search tool configuration with:
     - Connection ID
     - Index name
     - Query type (HYBRID recommended)

**For SDK Implementation:** See [language/python.md](language/python.md#rag-applications-with-python-sdk)

**Key Best Practices:**
- **Always request citations** in agent instructions
- Use **hybrid search** (AzureAISearchQueryType.HYBRID) for best results
- Instruct the agent to say "I don't know" when information isn't in the index
- Format citations consistently for easy parsing

#### Step 4: Test the RAG Agent

**Testing Process:**

1. **Query the agent** with a test question
2. **Stream the response** to get real-time output
3. **Capture citations** from the response annotations
4. **Validate** that citations are properly formatted and included

**For SDK Implementation:** See [language/python.md](language/python.md#testing-the-rag-agent)

**Troubleshooting RAG Issues:**

| Issue | Possible Cause | Resolution |
|-------|---------------|------------|
| No citations in response | Agent instructions don't request citations | Update instructions to explicitly request citation format |
| "Index not found" error | Wrong index name or connection | Verify `AI_SEARCH_INDEX_NAME` matches index in Azure AI Search |
| 401/403 authentication error | Missing RBAC permissions | Assign project managed identity **Search Index Data Contributor** role |
| Poor retrieval quality | Query type not optimal | Try HYBRID query type for better results |

### 3. Creating Your First AI Agent

#### Use Case
A developer wants to create an AI agent with tools (web search, function calling, file search).

#### Step 1: List Existing Agents

**Using MCP Tools:**

Use `foundry_agents_list` with your project endpoint to list existing agents.

#### Step 2: Create a Basic Agent

**Implementation:**

Create an agent with:
- **Model deployment name**: The model to use
- **Agent name**: Unique identifier
- **Instructions**: Clear, specific guidance for the agent's behavior

**For SDK Implementation:** See [language/python.md](language/python.md#basic-agent)

#### Step 3: Create an Agent with Custom Function Tools

Agents can call custom functions to perform actions like querying databases, calling APIs, or performing calculations.

**Implementation Steps:**

1. **Define custom functions** with clear docstrings describing their purpose and parameters
2. **Create a function toolset** with your custom functions
3. **Create the agent** with the toolset and instructions on when to use the tools

**For SDK Implementation:** See [language/python.md](language/python.md#agent-with-custom-function-tools)

#### Step 4: Create an Agent with Web Search

**Implementation:**

Create an agent with web search capabilities by adding a Web Search tool:
- Optionally specify user location for localized results
- Provide instructions to always cite web sources

**For SDK Implementation:** See [language/python.md](language/python.md#agent-with-web-search)

#### Step 5: Interact with the Agent

**Interaction Process:**

1. **Create a conversation thread** for the agent interaction
2. **Add user messages** to the thread
3. **Run the agent** to process the messages and generate responses
4. **Check run status** for success or failure
5. **Retrieve messages** to see the agent's responses
6. **Cleanup** by deleting the agent when done

**For SDK Implementation:** See [language/python.md](language/python.md#interacting-with-agents)

**Agent Best Practices:**

1. **Clear Instructions**: Provide specific, actionable instructions
2. **Tool Selection**: Only include tools the agent needs
3. **Error Handling**: Always check `run.status` for failures
4. **Cleanup**: Delete agents/threads when done to manage costs
5. **Rate Limits**: Handle rate limit errors gracefully (status code 429)


### 4. Evaluating Agent Performance

#### Use Case
A developer has built an agent and wants to evaluate its quality, safety, and performance.

#### Understanding Agent Evaluators

**Built-in Evaluators:**

1. **IntentResolutionEvaluator**: Measures how well the agent identifies and understands user requests (score 1-5)
2. **TaskAdherenceEvaluator**: Evaluates whether responses adhere to assigned tasks and system instructions (score 1-5)
3. **ToolCallAccuracyEvaluator**: Assesses whether the agent makes correct function tool calls (score 1-5)

**Evaluation Output:**
Each evaluator returns:
- `{metric_name}`: Numerical score (1-5, higher is better)
- `{metric_name}_result`: "pass" or "fail" based on threshold
- `{metric_name}_threshold`: Binarization threshold (default or user-set)
- `{metric_name}_reason`: Explanation of the score

#### Step 1: Single Agent Run Evaluation

**Using MCP Tools:**

Use the `foundry_agents_query_and_evaluate` MCP tool to query an agent and evaluate the response in one call. Provide:
- Agent ID
- Query text
- Project endpoint
- Azure OpenAI endpoint and deployment for evaluation
- Comma-separated list of evaluators to use

**Example Output:**
```json
{
  "response": "The weather in Seattle is currently sunny and 22°C.",
  "evaluation": {
    "intent_resolution": 5.0,
    "intent_resolution_result": "pass",
    "intent_resolution_threshold": 3,
    "intent_resolution_reason": "The agent correctly identified the user's intent to get weather information and provided a relevant response.",
    "task_adherence": 4.0,
    "task_adherence_result": "pass",
    "tool_call_accuracy": 5.0,
    "tool_call_accuracy_result": "pass"
  }
}
```

#### Step 2: Evaluate Existing Response

If you already have the agent's response, you can evaluate it directly.

**Using MCP Tools:**

Use the `foundry_agents_evaluate` MCP tool to evaluate a specific query/response pair with a single evaluator.

**For SDK Implementation:** See [language/python.md](language/python.md#single-response-evaluation-using-mcp)

#### Step 3: Batch Evaluation

For evaluating multiple agent runs across multiple conversation threads:

1. **Convert agent thread data** to evaluation format
2. **Prepare evaluation data** from multiple thread IDs
3. **Set up evaluators** with appropriate configuration
4. **Run batch evaluation** and view results in the Foundry portal

**For SDK Implementation:** See [language/python.md](language/python.md#batch-evaluation)

#### Interpreting Evaluation Results

**Score Ranges (1-5 scale):**
- **5**: Excellent - Agent perfectly understood and executed the task
- **4**: Good - Minor issues, but overall successful
- **3**: Acceptable - Threshold for passing (default)
- **2**: Poor - Significant issues with understanding or execution
- **1**: Failed - Agent completely misunderstood or failed the task

**Common Evaluation Issues:**

| Issue | Cause | Resolution |
|-------|-------|------------|
| Job stuck in "Running" | Insufficient model capacity | Increase model quota/capacity and rerun |
| All metrics zero | Wrong evaluator or unsupported model | Verify evaluator compatibility with your model |
| Groundedness unexpectedly low | Incomplete context/retrieval | Verify RAG retrieval includes sufficient context |
| Evaluation missing | Not selected during setup | Rerun evaluation with required metrics |

### 5. Troubleshooting Common Issues

#### Deployment Issues

**Problem: Deployment Stays Pending or Fails**

##### Bash
```bash
# Check deployment status and details
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --output json

# Check account quota
az cognitiveservices account show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --query "properties.quotaLimit"
```

**Common Causes:**
- Insufficient quota in the region
- Region at capacity for the model
- Permission issues

**Resolution:**
1. Check quota limits in Azure Portal
2. Request quota increase if needed
3. Try deploying to a different region
4. Verify you have appropriate RBAC permissions

#### Agent Response Issues

**Problem: Agent Doesn't Return Citations (RAG)**

**Diagnostics:**
1. Check agent instructions explicitly request citations
2. Verify the tool choice is set to "required" or "auto"
3. Confirm the Azure AI Search connection is configured correctly

**Resolution:**

Update the agent's instructions to explicitly request citations in the format `[message_idx:search_idx†source]` and to only use the knowledge base, never the agent's own knowledge.

**For SDK Implementation:** See [language/python.md](language/python.md#update-agent-instructions)

**Problem: "Index Not Found" Error**

**Using MCP Tools:**

Use the `foundry_knowledge_index_list` MCP tool to verify the index exists and get the correct name.

**Resolution:**
1. Verify `AI_SEARCH_INDEX_NAME` environment variable matches actual index name
2. Check the connection points to correct Azure AI Search resource
3. Ensure index has been created and populated

**Problem: 401/403 Authentication Errors**

**Common Cause:** Missing RBAC permissions

**Resolution:**

##### Bash
```bash
# Assign Search Index Data Contributor role to managed identity
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Search Index Data Contributor" \
  --scope /subscriptions/<subscription-id>/resourceGroups/<rg>/providers/Microsoft.Search/searchServices/<search-service>

# Verify role assignment
az role assignment list \
  --assignee <managed-identity-principal-id> \
  --output table
```

#### Evaluation Issues

**Problem: Evaluation Dashboard Shows No Data**

**Common Causes:**
- No recent agent traffic
- Time range excludes the data
- Ingestion delay

**Resolution:**
1. Generate new agent traffic (test queries)
2. Expand the time range filter in the dashboard
3. Wait a few minutes for data ingestion
4. Refresh the dashboard

**Problem: Continuous Evaluation Not Running**

**Diagnostics:**

Check evaluation run status to identify issues. For SDK implementation, see [language/python.md](language/python.md#checking-evaluation-status).

**Resolution:**
1. Verify the evaluation rule is enabled
2. Confirm agent traffic is flowing
3. Check project managed identity has **Azure AI User** role
4. Verify OpenAI endpoint and deployment are accessible

#### Rate Limiting and Capacity Issues

**Problem: Agent Run Fails with Rate Limit Error**

**Error Message:** `Rate limit is exceeded` or HTTP 429

**Resolution:**

##### Bash
```bash
# Check current quota usage
az cognitiveservices usage list \
  --name <resource-name> \
  --resource-group <resource-group>

# Request quota increase (manual process in portal)
echo "Request quota increase in Azure Portal under Quotas section"
```

# Request quota increase (manual process in portal)
Write-Output "Request quota increase in Azure Portal under Quotas section"
```

**Best Practices:**
- Implement exponential backoff retry logic
- Use Dynamic Quota when available
- Monitor quota usage proactively
- Consider multiple deployments across regions

## Quick Reference

### Common Environment Variables

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

### Useful MCP Tools Quick Reference

**Resource Management**
- `foundry_resource_get` - Get resource details and endpoint

**Models**
- `foundry_models_list` - Browse model catalog
- `foundry_models_deploy` - Deploy a model
- `foundry_models_deployments_list` - List deployed models

**Knowledge & RAG**
- `foundry_knowledge_index_list` - List knowledge indexes
- `foundry_knowledge_index_schema` - Get index schema

**Agents**
- `foundry_agents_list` - List agents
- `foundry_agents_connect` - Query an agent
- `foundry_agents_query_and_evaluate` - Query and evaluate

**OpenAI Operations**
- `foundry_openai_chat_completions_create` - Create chat completions
- `foundry_openai_embeddings_create` - Create embeddings

### Language-Specific Quick References

For SDK-specific details, authentication, and code examples:
- **Python**: See [language/python.md](language/python.md)

## Additional Resources

### Documentation Links
- [Microsoft Foundry Documentation](https://learn.microsoft.com/azure/ai-foundry/)
- [Microsoft Foundry Quickstart](https://learn.microsoft.com/azure/ai-foundry/quickstarts/get-started-code)
- [RAG and Knowledge Indexes](https://learn.microsoft.com/azure/ai-foundry/concepts/retrieval-augmented-generation)
- [Agent Evaluation Guide](https://learn.microsoft.com/azure/ai-foundry/how-to/develop/agent-evaluate-sdk)

### GitHub Samples
- [Microsoft Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
- [Azure Search OpenAI Demo](https://github.com/Azure-Samples/azure-search-openai-demo)
- [Azure Search Classic RAG](https://github.com/Azure-Samples/azure-search-classic-rag)
