# Microsoft Foundry - Python SDK

## Setup

```bash
pip install azure-ai-projects azure-identity azure-ai-inference openai azure-ai-evaluation python-dotenv
```

```python
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
```

**Environment Variables (.env):**
```bash
PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
MODEL_DEPLOYMENT_NAME=gpt-4o
AZURE_AI_SEARCH_CONNECTION_NAME=my-search-connection
AI_SEARCH_INDEX_NAME=my-index
```

## MCP Tools

```python
foundry_models_list()                              # List models
foundry_models_list(publisher="OpenAI")            # Filter by publisher
foundry_models_deploy(resource_group="rg", deployment="gpt-4o", model_name="gpt-4o",
    model_format="OpenAI", azure_ai_services="my-foundry", sku_capacity=10)
foundry_resource_get(resource_name="my-foundry", resource_group="rg")
```

## RAG Agent

```python
from azure.ai.projects import AIProjectClient
from azure.ai.agents.models import AzureAISearchToolDefinition, AzureAISearchToolResource, AISearchIndexResource

project_client = AIProjectClient(endpoint=os.environ["PROJECT_ENDPOINT"], credential=DefaultAzureCredential())
conn = project_client.connections.get(os.environ["AZURE_AI_SEARCH_CONNECTION_NAME"])
search_resource = AzureAISearchToolResource(indexes=[AISearchIndexResource(
    index_connection_id=conn.id, index_name=os.environ["AI_SEARCH_INDEX_NAME"])])
agent = project_client.agents.create_agent(model=os.environ["MODEL_DEPLOYMENT_NAME"], name="RAGAgent",
    instructions="Answer using knowledge base. Cite as: `[idx:idx†source]`.",
    tools=[AzureAISearchToolDefinition(azure_ai_search=search_resource)])
```

## Basic Agent

```python
project_client = AIProjectClient(endpoint=os.environ["PROJECT_ENDPOINT"], credential=DefaultAzureCredential())
agent = project_client.agents.create_agent(model=os.environ["MODEL_DEPLOYMENT_NAME"],
    name="my-agent", instructions="You are helpful.")
```

## Agent Interaction

```python
thread = project_client.agents.threads.create()
project_client.agents.messages.create(thread_id=thread.id, role="user", content="Hello")
run = project_client.agents.runs.create_and_process(thread_id=thread.id, agent_id=agent.id)
messages = project_client.agents.messages.list(thread_id=thread.id)
for msg in messages:
    if msg.text_messages: print(f"{msg.role}: {msg.text_messages[-1].text.value}")
project_client.agents.delete_agent(agent.id)  # Cleanup
```

## Evaluation

```python
foundry_agents_query_and_evaluate(agent_id="<id>", query="Weather?",
    endpoint="<project_endpoint>", evaluators="intent_resolution,task_adherence")
```

## Error Handling

```python
from azure.core.exceptions import HttpResponseError
try:
    agent = project_client.agents.create_agent(...)
except HttpResponseError as e:
    print(f"Error {e.status_code}: {e.message}")  # Handle 429, 401
```

## Best Practices

- Use environment variables, never hardcode credentials
- Reuse `AIProjectClient` instances
- Use context managers for cleanup
- Handle rate limits with exponential backoff
