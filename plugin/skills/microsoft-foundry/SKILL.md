---
name: microsoft-foundry
description: |
  Use this skill for Microsoft Foundry (Azure AI Foundry): deploy models from catalog, build RAG apps, create/evaluate AI agents, manage RBAC/permissions, manage quotas/capacity, create Foundry resources.
  USE FOR: Microsoft Foundry, AI Foundry, deploy model, deploy GPT, OpenAI model, model catalog, RAG, knowledge index, create agent, evaluate agent, agent monitoring, create Foundry project, set up Foundry, onboard Foundry, provision Foundry, create Foundry resource, AIServices, register resource provider, RBAC, role assignment, managed identity, service principal, quota, capacity, TPM, PTU, QuotaExceeded, InsufficientQuota, DeploymentLimitReached, check quota, quota increase, model deployment, rate limiting, 429 errors, deployment health, inference failures, model availability, regional availability, azd deploy agent, azd up agent.
  DO NOT USE FOR: Azure Functions (use azure-functions), App Service (use azure-create-app), generic resource creation (use azure-create-app), AI Search/speech/OCR (use azure-ai).
---

# Microsoft Foundry Skill

This skill helps developers work with Microsoft Foundry resources, covering model discovery and deployment, complete dev lifecycle of AI agent, evaluation workflows, and troubleshooting.

## Sub-Skills

> **MANDATORY: Before executing ANY workflow, you MUST read the corresponding sub-skill document.** Do not call MCP tools for a workflow without reading its skill document. This applies even if you already know the MCP tool parameters — the skill document contains required workflow steps, pre-checks, and validation logic that must be followed. This rule applies on every new user message that triggers a different workflow, even if the skill is already loaded.

This skill includes specialized sub-skills for specific workflows. **Use these instead of the main skill when they match your task:**

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Full deployment pipeline: project scan → env vars → Dockerfile → ACR build → agent creation → container startup → verification. **Use this skill instead of manually calling agent_update or az acr build.** USE FOR: deploy agent to foundry, push agent, build container, redeploy, start/stop container, clone/delete agent. | [deploy](foundry-agent/deploy/deploy.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](foundry-agent/invoke/invoke.md) |
| **troubleshoot** | View container logs, query telemetry, diagnose failures | [troubleshoot](foundry-agent/troubleshoot/troubleshoot.md) |
| **create** | Create new hosted agent applications. Supports Microsoft Agent Framework, LangGraph, or custom frameworks in Python or C#. Downloads starter samples from foundry-samples repo. | [create](foundry-agent/create/create.md) |
| **observe** | Eval-driven optimization loop for Foundry agents. Orchestrates the full pipeline: auto-create evaluators & test dataset → batch evaluate → cluster failures → optimize prompt → re-deploy → compare versions → iterate. **Use this skill instead of manually calling evaluation MCP tools.** USE FOR: evaluate agent, run eval, test agent quality, analyze eval results, cluster failures, optimize prompt, compare versions, CI/CD evals, agent monitoring. | [observe](foundry-agent/observe/observe.md) |
| **project/create** | Creating a new Azure AI Foundry project for hosting agents and models. Use when onboarding to Foundry or setting up new infrastructure. | [project/create/create-foundry-project.md](project/create/create-foundry-project.md) |
| **resource/create** | Creating Azure AI Services multi-service resource (Foundry resource) using Azure CLI. Use when manually provisioning AI Services resources with granular control. | [resource/create/create-foundry-resource.md](resource/create/create-foundry-resource.md) |
| **models/deploy-model** | Unified model deployment with intelligent routing. Handles quick preset deployments, fully customized deployments (version/SKU/capacity/RAI), and capacity discovery across regions. Routes to sub-skills: `preset` (quick deploy), `customize` (full control), `capacity` (find availability). | [models/deploy-model/SKILL.md](models/deploy-model/SKILL.md) |
| **foundry-agent** | Full agent lifecycle: create, deploy, invoke, and troubleshoot both prompt and hosted agents. Routes to create-prompt (MCP/SDK), create-hosted (sample-based), deploy, invoke, and troubleshoot workflows. | [foundry-agent/SKILL.md](foundry-agent/SKILL.md) |
| **quota**| Managing quotas and capacity for Microsoft Foundry resources. Use when checking quota usage, troubleshooting deployment failures due to insufficient quota, requesting quota increases, or planning capacity. | [quota/quota.md](quota/quota.md) |
| **rbac** | Managing RBAC permissions, role assignments, managed identities, and service principals for Microsoft Foundry resources. Use for access control, auditing permissions, and CI/CD setup. | [rbac/rbac.md](rbac/rbac.md) |

> 💡 **Tip:** For a complete onboarding flow: `project/create` → `foundry-agent` (create → deploy → invoke). The `foundry-agent` SKILL.md routes between prompt agent creation (MCP/SDK) and hosted agent creation (sample-based).

> 💡 **Model Deployment:** Use `models/deploy-model` for all deployment scenarios — it intelligently routes between quick preset deployment, customized deployment with full control, and capacity discovery across regions.

## Agent Development Lifecycle

Match user intent to the correct workflow. Read each sub-skill in order before executing.

| User Intent | Workflow (read in order) |
|-------------|------------------------|
| Create a new agent from scratch | [create](foundry-agent/create/create.md) → [deploy](foundry-agent/deploy/deploy.md) → [invoke](foundry-agent/invoke/invoke.md) |
| Deploy an agent (code already exists) | deploy → invoke |
| Update/redeploy an agent after code changes | deploy → invoke |
| Invoke/test/chat with an agent | invoke |
| Troubleshoot an agent issue | invoke → troubleshoot |
| Fix a broken agent (troubleshoot + redeploy) | invoke → troubleshoot → apply fixes → deploy → invoke |
| Start/stop agent container | deploy |
| Evaluate/optimize an agent | [observe](foundry-agent/observe/observe.md) |

## Agent: Project Context Resolution

Agent skills should run this step **only when they need configuration values they don't already have**. If a value (e.g., project endpoint, agent name) is already known from the user's message or a previous skill in the same session, skip resolution for that value.

### Step 1: Detect azd Project

If any required configuration value is missing, check if `azure.yaml` exists in the project root (workspace root or user-specified project path). If found, run `azd env get-values` to load environment variables.

### Step 2: Resolve Common Configuration

Match missing values against the azd environment:

| azd Variable | Resolves To | Used By |
|-------------|-------------|---------|
| `AZURE_AI_PROJECT_ENDPOINT` or `AZURE_AIPROJECT_ENDPOINT` | Project endpoint | deploy, invoke, troubleshoot |
| `AZURE_CONTAINER_REGISTRY_NAME` or `AZURE_CONTAINER_REGISTRY_ENDPOINT` | ACR registry name / image URL prefix | deploy |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | troubleshoot |

### Step 3: Collect Missing Values

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from the user's message, session context, or azd environment. Common values skills may need:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the target agent

> 💡 **Tip:** If the user provides a project endpoint or agent name in their initial message, extract it directly — do not ask again.

## Agent: Agent Types

All agent skills support two agent types:

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment |
| **Hosted** | `"hosted"` | Container-based agents running custom code |

Use `agent_get` MCP tool to determine an agent's type when needed.

## Tool Usage Conventions

```bash
az cognitiveservices account list \
  --query "[?kind=='AIServices'].{Name:name, ResourceGroup:resourceGroup, Location:location}" \
  -o table
```

> 💡 **Tip:** Foundry resources are `Microsoft.CognitiveServices/accounts` with `kind=='AIServices'`. These are the multi-service resources that support model deployments, agents, and other Foundry capabilities.

| Result | Action |
|--------|--------|
| ✅ Resources found | List all resources and ask user to select one |
| ❌ No resources | Ask user: "No Foundry resources found. Would you like to create one?" → Route to [resource/create](resource/create/create-foundry-resource.md) |

**When listing resources, present them as a numbered selection:**

```
Found 3 Foundry resources:
  1. my-ai-resource   (rg-ai-dev,     eastus)
  2. prod-resource    (rg-prod,       westus2)
  3. experiment-res   (rg-research,   northcentralus)

Which resource would you like to use?
```

### Phase 4: Confirm Selected Project

After selection, verify the project exists and display confirmation:

```bash
az cognitiveservices account show \
  --name <project-name> \
  --resource-group <resource-group> \
  --query "{Name:name, Location:location, ResourceGroup:resourceGroup, State:properties.provisioningState}" \
  -o table
```

```
Using project:
  Project:  <project-name>
  Region:   <location>
  Resource: <resource-group>
  State:    Succeeded

Proceeding with: <requested-operation>
```

> ⚠️ **Warning:** Never proceed with any operation without confirming the target project with the user. This prevents accidental operations on the wrong resource.

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
- **Python**: See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md) for Python SDK setup, authentication, and examples

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

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#rag-agent-with-azure-ai-search)

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

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#querying-a-rag-agent-streaming)

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

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#basic-agent)

#### Step 3: Create an Agent with Custom Function Tools

Agents can call custom functions to perform actions like querying databases, calling APIs, or performing calculations.

**Implementation Steps:**

1. **Define custom functions** with clear docstrings describing their purpose and parameters
2. **Create a function toolset** with your custom functions
3. **Create the agent** with the toolset and instructions on when to use the tools

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#agent-with-custom-function-tools)

#### Step 4: Create an Agent with Web Search

**Implementation:**

Create an agent with web search capabilities by adding a Web Search Preview tool:
- No external resource or connection required — works out of the box
- Optionally specify user location for localized results
- Provide instructions to always cite web sources

> ⚠️ **Default:** Use `WebSearchPreviewTool` for web search. Only use Bing Grounding (`BingGroundingAgentTool`) if the user explicitly requests Grounding with Bing Search or Grounding with Bing Custom Search.

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#agent-with-web-search)

#### Step 5: Interact with the Agent

**Interaction Process:**

1. **Create a conversation thread** for the agent interaction
2. **Add user messages** to the thread
3. **Run the agent** to process the messages and generate responses
4. **Check run status** for success or failure
5. **Retrieve messages** to see the agent's responses
6. **Cleanup** by deleting the agent when done

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#interacting-with-agents)

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

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#single-response-evaluation-mcp)

#### Step 3: Batch Evaluation

For evaluating multiple agent runs across multiple conversation threads:

1. **Convert agent thread data** to evaluation format
2. **Prepare evaluation data** from multiple thread IDs
3. **Set up evaluators** with appropriate configuration
4. **Run batch evaluation** and view results in the Foundry portal

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#batch-evaluation)

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

**For SDK Implementation:** See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#creating-agents)

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

Check evaluation run status to identify issues. For SDK implementation, see [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md#agent-evaluation).

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
# Check current quota usage for region
subId=$(az account show --query id -o tsv)
region="eastus"  # Change to your region
az rest --method get \
  --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/locations/$region/usages?api-version=2023-05-01" \
  --query "value[?contains(name.value,'OpenAI.Standard')].{Model:name.value, Used:currentValue, Limit:limit, Available:(limit-currentValue)}" \
  --output table

# For detailed quota guidance, use the quota sub-skill: microsoft-foundry:quota
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
- **Python**: See [references/sdk/foundry-sdk-py.md](references/sdk/foundry-sdk-py.md)

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)

## SDK Quick Reference

- [Python](references/sdk/foundry-sdk-py.md)
