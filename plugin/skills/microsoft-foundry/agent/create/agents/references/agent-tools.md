# Agent Tools for Foundry Agent Service

Add tools to agents to extend capabilities. Tools let agents access data, execute code, and call external APIs.

## Code Interpreter

Enables agents to write and run Python code in a sandboxed environment.

```python
from azure.ai.projects.models import PromptAgentDefinition, CodeInterpreterTool

code_interpreter = CodeInterpreterTool()

agent = project_client.agents.create_version(
    agent_name="CodingAgent",
    definition=PromptAgentDefinition(
        model=os.environ["MODEL_DEPLOYMENT_NAME"],
        instructions="You are a helpful assistant. Use code interpreter to solve math and data problems.",
        tools=code_interpreter.definitions,
        tool_resources=code_interpreter.resources,
    ),
)
```

## Function Calling

Define custom functions the agent can invoke.

```python
from azure.ai.projects.models import PromptAgentDefinition, FunctionTool

functions = FunctionTool(functions=[
    {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City name"}
            },
            "required": ["location"]
        }
    }
])

agent = project_client.agents.create_version(
    agent_name="WeatherAgent",
    definition=PromptAgentDefinition(
        model=os.environ["MODEL_DEPLOYMENT_NAME"],
        instructions="Use the get_weather function to answer weather questions.",
        tools=functions.definitions,
    ),
)
```

## Azure AI Search (Grounding)

Ground agent responses with data from an Azure AI Search index.

```python
from azure.ai.projects.models import PromptAgentDefinition, AzureAISearchTool

search_tool = AzureAISearchTool(
    index_connection_id="<connection-id>",
    index_name="<index-name>",
)

agent = project_client.agents.create_version(
    agent_name="SearchAgent",
    definition=PromptAgentDefinition(
        model=os.environ["MODEL_DEPLOYMENT_NAME"],
        instructions="Answer questions using the search index. Always cite sources.",
        tools=search_tool.definitions,
        tool_resources=search_tool.resources,
    ),
)
```

## Bing Grounding

Access real-time web information via Bing Search.

```python
from azure.ai.projects.models import PromptAgentDefinition, BingGroundingTool

bing_tool = BingGroundingTool(connection_id="<bing-connection-id>")

agent = project_client.agents.create_version(
    agent_name="WebAgent",
    definition=PromptAgentDefinition(
        model=os.environ["MODEL_DEPLOYMENT_NAME"],
        instructions="Use Bing to find current information. Always cite web sources.",
        tools=bing_tool.definitions,
    ),
)
```

## Tool Summary

| Tool | Import | Use Case |
|------|--------|----------|
| `CodeInterpreterTool` | `azure.ai.projects.models` | Math, data analysis, file generation |
| `FunctionTool` | `azure.ai.projects.models` | Custom API calls, business logic |
| `AzureAISearchTool` | `azure.ai.projects.models` | Private data grounding |
| `BingGroundingTool` | `azure.ai.projects.models` | Real-time web information |
| `FileSearchTool` | `azure.ai.projects.models` | Search uploaded files |
| `OpenApiTool` | `azure.ai.projects.models` | External API via OpenAPI spec |

> **Tip:** Combine multiple tools on one agent. The model decides which tool to invoke based on user intent and instructions.
