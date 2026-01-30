# Microsoft Foundry Quick Reference

## Environment Variables

```bash
PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
MODEL_DEPLOYMENT_NAME=gpt-4o
AZURE_AI_SEARCH_CONNECTION_NAME=my-search-connection
AI_SEARCH_INDEX_NAME=my-index
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `foundry_resource_get` | Get resource details |
| `foundry_models_list` | Browse model catalog |
| `foundry_models_deploy` | Deploy a model |
| `foundry_knowledge_index_list` | List knowledge indexes |
| `foundry_agents_list` | List agents |
| `foundry_agents_connect` | Query an agent |
| `foundry_openai_chat_completions_create` | Chat completions |

## Prerequisites

- Azure subscription with Foundry permissions
- Azure CLI authenticated (`az login`)
- Python SDK: See [python.md](python.md)

## Documentation

- [Foundry Docs](https://learn.microsoft.com/azure/ai-foundry/)
- [RAG Guide](https://learn.microsoft.com/azure/ai-foundry/concepts/retrieval-augmented-generation)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
