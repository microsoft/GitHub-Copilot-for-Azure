# Agent Tools — Simple Tools

Add tools to agents to extend capabilities. This file covers tools that work without external connections. For tools requiring connections/RBAC setup, see:
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

## Bing Grounding

Access real-time web information via Bing Search. Requires a [Grounding with Bing Search resource](https://portal.azure.com/#create/Microsoft.BingGroundingSearch) and a [project connection](../../../../project/connections.md).

**RBAC:** `Contributor` or `Owner` at subscription/RG level to create Bing resource and get keys. `Azure AI Project Manager` on project to create connection.

**Setup:**
1. Create Bing Grounding resource (`az provider register --namespace 'Microsoft.Bing'`)
2. Create project connection with Bing resource key — see [connections](../../../../project/connections.md)
3. Set `BING_PROJECT_CONNECTION_NAME` env var

```python
import os
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import (
    PromptAgentDefinition, BingGroundingAgentTool,
    BingGroundingSearchToolParameters, BingGroundingSearchConfiguration,
)
from azure.identity import DefaultAzureCredential

with (
    DefaultAzureCredential() as credential,
    AIProjectClient(endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"], credential=credential) as project_client,
    project_client.get_openai_client() as openai_client,
):
    bing_conn = project_client.connections.get(os.environ["BING_PROJECT_CONNECTION_NAME"])

    agent = project_client.agents.create_version(
        agent_name="WebAgent",
        definition=PromptAgentDefinition(
            model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
            instructions="You are a helpful assistant.",
            tools=[
                BingGroundingAgentTool(
                    bing_grounding=BingGroundingSearchToolParameters(
                        search_configurations=[
                            BingGroundingSearchConfiguration(project_connection_id=bing_conn.id)
                        ]
                    )
                )
            ],
        ),
    )

    # Stream response — use tool_choice="required" to force tool use
    stream = openai_client.responses.create(
        stream=True, tool_choice="required",
        input="What is the top AI news today?",
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )
    # Process: response.output_text.delta for text, url_citation annotations for sources
```

> **Important:** Bing data flows outside Azure compliance boundary. Review [terms of use](https://www.microsoft.com/bing/apis/grounding-legal-enterprise). Not supported with VPN/Private Endpoints.

## Tool Summary

| Tool | Connection? | Reference |
|------|-------------|-----------|
| `CodeInterpreterTool` | No | This file |
| `FunctionTool` | No | This file |
| `BingGroundingAgentTool` | Yes (Bing) | This file |
| `AzureAISearchAgentTool` | Yes (Search) | [tool-azure-ai-search.md](tool-azure-ai-search.md) |
| `MCPTool` | Optional | [tool-mcp.md](tool-mcp.md) |

> Combine multiple tools on one agent. The model decides which to invoke.
