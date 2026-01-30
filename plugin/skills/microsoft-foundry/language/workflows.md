# Microsoft Foundry Workflows

## 1. Model Discovery and Deployment

### List Resources
```bash
az resource list --resource-type "Microsoft.CognitiveServices/accounts" \
  --query "[?kind=='AIServices'].{Name:name, RG:resourceGroup}" -o table
```

Or use MCP: `foundry_resource_get()`

### Browse Models

**MCP Tools:**
- `foundry_models_list()` - All models
- `foundry_models_list(search-for-free-playground=true)` - Free playground models
- `foundry_models_list(publisher="OpenAI")` - Filter by publisher

### Deploy Model

```bash
az cognitiveservices account deployment create \
  --name <foundry-resource> -g <rg> --deployment-name gpt-4o-deployment \
  --model-name gpt-4o --model-version "2024-05-13" --model-format OpenAI --sku-capacity 10
```

Or use MCP: `foundry_models_deploy(resource_group, deployment, model_name, model_format, azure_ai_services, sku_capacity)`

### Get Endpoint

Use `foundry_resource_get(resource_name, resource_group)` - returns `https://<resource>.services.ai.azure.com/api/projects/<project>`

## 2. RAG Applications

### List Knowledge Indexes

`foundry_knowledge_index_list(endpoint="<project_endpoint>")`

### Inspect Schema

`foundry_knowledge_index_schema(endpoint="<endpoint>", index="my-index")`

### Create RAG Agent

See [python.md](python.md#rag-agent) for SDK implementation.

**Key Points:**
- Use HYBRID query type for best results
- Always request citations in instructions
- Instruct agent to say "I don't know" when info not in index

**Troubleshooting:**

| Issue | Resolution |
|-------|------------|
| No citations | Update instructions to request citations |
| Index not found | Verify `AI_SEARCH_INDEX_NAME` |
| 401/403 error | Assign **Search Index Data Contributor** role |

## 3. AI Agents

### List Agents

`foundry_agents_list(endpoint="<project_endpoint>")`

### Create Agent

See [python.md](python.md#basic-agent) for SDK.

**Agent Types:**
- Basic agent - Simple instructions
- Function tools - Custom Python functions
- Web search - BingGroundingToolDefinition
- RAG - AzureAISearchToolDefinition

### Interact with Agent

See [python.md](python.md#agent-interaction) for SDK.

**Best Practices:**
- Clear, specific instructions
- Only include needed tools
- Check `run.status` for failures
- Delete agents/threads when done

## 4. Evaluation

### Single Run Evaluation

`foundry_agents_query_and_evaluate(agent_id, query, endpoint, evaluators="intent_resolution,task_adherence")`

### Evaluators

| Evaluator | Measures |
|-----------|----------|
| IntentResolutionEvaluator | Understanding user requests (1-5) |
| TaskAdherenceEvaluator | Following instructions (1-5) |
| ToolCallAccuracyEvaluator | Correct tool usage (1-5) |

**Scores:** 5=Excellent, 4=Good, 3=Threshold, 2=Poor, 1=Failed

### Batch Evaluation

See [python.md](python.md#evaluation) for SDK.

## Common Issues

| Issue | Resolution |
|-------|------------|
| 401 Unauthorized | Run `az login`, check credentials |
| 429 Rate limit | Add retry with exponential backoff |
| Deployment failed | Check quota, region capacity, permissions |
| Model not found | Verify model name and availability in region |
