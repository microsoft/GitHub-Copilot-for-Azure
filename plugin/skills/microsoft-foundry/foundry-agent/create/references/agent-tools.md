# Agent Tools — Simple Tools

Add tools to agents to extend capabilities. This file covers tools that work without external connections. For tools requiring connections/RBAC setup, see:
- [Web Search tool](tool-web-search.md) — real-time public web search with citations (default for web search)
- [Bing Grounding tool](tool-bing-grounding.md) — web search via dedicated Bing resource (only when explicitly requested)
- [Azure AI Search tool](tool-azure-ai-search.md) — private data grounding with vector search
- [MCP tool](tool-mcp.md) — remote Model Context Protocol servers

## Code Interpreter

Enables agents to write and run Python in a sandboxed environment. Supports data analysis, chart generation, and file processing. Has [additional charges](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/) beyond token-based fees.

```python
import os
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import (
    PromptAgentDefinition, CodeInterpreterTool, CodeInterpreterToolAuto,
)
from azure.identity import DefaultAzureCredential

project_client = AIProjectClient(
    endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)
with project_client:
    openai_client = project_client.get_openai_client()

    # Optional: upload a file for analysis
    with open("data.csv", "rb") as f:
        file = openai_client.files.create(purpose="assistants", file=f)

    agent = project_client.agents.create_version(
        agent_name="CodingAgent",
        definition=PromptAgentDefinition(
            model=os.environ["FOUNDRY_MODEL_DEPLOYMENT_NAME"],
            instructions="You are a helpful assistant.",
            tools=[CodeInterpreterTool(container=CodeInterpreterToolAuto(file_ids=[file.id]))],
        ),
    )

    # Send request — response annotations contain generated file IDs
    conversation = openai_client.conversations.create()
    response = openai_client.responses.create(
        conversation=conversation.id,
        input="Create a bar chart from the uploaded CSV.",
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )
    # Download generated files via container_file_citation annotations
    # ann.file_id + ann.container_id → openai_client.containers.files.content.retrieve(...)
```

> Sessions: 1-hour active / 30-min idle timeout. Each conversation = separate billable session.

## Function Calling

Define custom functions the agent can invoke. Your app executes the function and returns results. Runs expire 10 minutes after creation — return tool outputs promptly.

```python
import os, json
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition, FunctionTool
from azure.identity import DefaultAzureCredential
from openai.types.responses.response_input_param import FunctionCallOutput

project_client = AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

func_tool = FunctionTool(
    name="get_weather",
    parameters={
        "type": "object",
        "properties": {"location": {"type": "string", "description": "City name"}},
        "required": ["location"],
        "additionalProperties": False,
    },
    description="Get current weather for a location.",
    strict=True,
)

def get_weather(location: str) -> str:
    return f"Weather in {location}: 72°F, partly cloudy."

with project_client:
    agent = project_client.agents.create_version(
        agent_name="WeatherAgent",
        definition=PromptAgentDefinition(
            model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
            instructions="Use functions to answer questions.",
            tools=[func_tool],
        ),
    )
    openai_client = project_client.get_openai_client()
    response = openai_client.responses.create(
        input="What's the weather in Seattle?",
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )

    # Process function calls — execute and return results
    input_list = []
    for item in response.output:
        if item.type == "function_call":
            result = get_weather(**json.loads(item.arguments))
            input_list.append(FunctionCallOutput(
                type="function_call_output", call_id=item.call_id,
                output=json.dumps({"weather": result}),
            ))

    # Send output back for final response
    response = openai_client.responses.create(
        input=input_list, previous_response_id=response.id,
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )
```

> **Security:** Treat tool arguments as untrusted input. Don't pass secrets in tool output. Use `strict=True` for schema validation.

## Tool Summary

| Tool | Connection? | Reference |
|------|-------------|-----------|
| `CodeInterpreterTool` | No | This file |
| `FunctionTool` | No | This file |
| `WebSearchPreviewTool` | No | [tool-web-search.md](tool-web-search.md) |
| `BingGroundingAgentTool` | Yes (Bing) | [tool-bing-grounding.md](tool-bing-grounding.md) |
| `AzureAISearchAgentTool` | Yes (Search) | [tool-azure-ai-search.md](tool-azure-ai-search.md) |
| `MCPTool` | Optional | [tool-mcp.md](tool-mcp.md) |

> ⚠️ **Default for web search:** Use `WebSearchPreviewTool` unless the user explicitly requests Bing Grounding or Bing Custom Search.

> Combine multiple tools on one agent. The model decides which to invoke.
