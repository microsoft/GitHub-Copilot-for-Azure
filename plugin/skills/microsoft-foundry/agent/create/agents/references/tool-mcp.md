# MCP Tool (Model Context Protocol)

Connect agents to remote MCP servers to extend capabilities with external tools and data sources. MCP is an open standard for LLM tool integration.

## Prerequisites

- `azure-ai-projects` package (`pip install azure-ai-projects --pre`)
- A remote MCP server endpoint (e.g., `https://api.githubcopilot.com/mcp`)
- For authenticated servers: a [project connection](../../../../project/connections.md) storing credentials
- RBAC: **Contributor** or **Owner** role on the Foundry project

## Environment Variables

```bash
export AZURE_AI_PROJECT_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"
export AZURE_AI_MODEL_DEPLOYMENT_NAME="gpt-4o"
export MCP_PROJECT_CONNECTION_NAME="my-mcp-connection"  # only for authenticated servers
```

## Create MCP Connection (Authenticated Servers)

For authenticated MCP servers, create a project connection to store credentials. See [Project Connections](../../../../project/connections.md).

```bash
# API key connection for authenticated MCP server
cat <<EOF > mcp-connection.yml
name: github-mcp
type: api_key
endpoint: https://api.githubcopilot.com/mcp
api_key: <your-token>
EOF

az ml connection create --file mcp-connection.yml \
  --resource-group <rg> --workspace-name <project-name>
```

Unauthenticated servers (public endpoints) don't need a connection — omit `project_connection_id`.

## Full Code Sample

```python
import os
import json
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition, MCPTool
from openai.types.responses.response_input_param import (
    McpApprovalResponse,
    ResponseInputParam,
)

load_dotenv()

with (
    DefaultAzureCredential() as credential,
    AIProjectClient(
        endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"], credential=credential
    ) as project_client,
    project_client.get_openai_client() as openai_client,
):
    # Declare the MCP tool
    tool = MCPTool(
        server_label="github",
        server_url="https://api.githubcopilot.com/mcp",
        require_approval="always",  # "always" | "never" | {"never": ["tool1"]}
        allowed_tools=["get_me"],   # optional allow-list (recommended)
        project_connection_id=os.getenv("MCP_PROJECT_CONNECTION_NAME"),
    )

    agent = project_client.agents.create_version(
        agent_name="MCPAgent",
        definition=PromptAgentDefinition(
            model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
            instructions="Use MCP tools as needed.",
            tools=[tool],
        ),
    )
    print(f"Agent created: {agent.name} v{agent.version}")

    # Create conversation and send initial request
    conversation = openai_client.conversations.create()
    response = openai_client.responses.create(
        conversation=conversation.id,
        input="What is my GitHub username?",
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )

    # Handle MCP approval requests
    input_list: ResponseInputParam = []
    for item in response.output:
        if item.type == "mcp_approval_request" and item.id:
            print(f"MCP approval requested:")
            print(f"  Server: {item.server_label}")
            print(f"  Tool: {getattr(item, 'name', '<unknown>')}")
            print(f"  Args: {json.dumps(getattr(item, 'arguments', None), indent=2, default=str)}")

            # Review before approving — implement your own policy in production
            should_approve = (
                input("Approve? (y/N): ").strip().lower() == "y"
            )
            input_list.append(
                McpApprovalResponse(
                    type="mcp_approval_response",
                    approve=should_approve,
                    approval_request_id=item.id,
                )
            )

    # Send approval and get final response
    response = openai_client.responses.create(
        input=input_list,
        previous_response_id=response.id,
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )
    print(f"Response: {response.output_text}")

    # Cleanup
    project_client.agents.delete_version(
        agent_name=agent.name, agent_version=agent.version
    )
```

## MCPTool Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `server_label` | Yes | Unique label for this MCP server within the agent |
| `server_url` | Yes | Remote MCP server endpoint URL |
| `require_approval` | No | `"always"` (default), `"never"`, or `{"never": ["tool1"]}` / `{"always": ["tool1"]}` |
| `allowed_tools` | No | List of specific tools to enable (default: all) |
| `project_connection_id` | No | Connection ID for authenticated servers |

## Approval Workflow

1. Agent sends request → MCP server returns tool calls
2. Response contains `mcp_approval_request` items
3. Your code reviews tool name + arguments
4. Submit `McpApprovalResponse` with `approve=True/False`
5. Agent completes work using approved tool results

> **Best practice:** Always use `require_approval="always"` unless you fully trust the MCP server. Use `allowed_tools` to restrict which tools the agent can access.

## Hosting Local MCP Servers

Agent Service only accepts **remote** MCP endpoints. To use a local server, deploy it to:

| Platform | Transport | Notes |
|----------|-----------|-------|
| [Azure Container Apps](https://github.com/Azure-Samples/mcp-container-ts) | HTTP POST/GET | Any language, container rebuild needed |
| [Azure Functions](https://github.com/Azure-Samples/mcp-sdk-functions-hosting-python) | HTTP streamable | Python/Node/.NET/Java, key-based auth |

## Known Limitations

- **100-second timeout** for non-streaming MCP tool calls
- **Identity passthrough not supported in Teams** — agents published to Teams use project managed identity
- **Network-secured Foundry** can't use private MCP servers in same vNET — only public endpoints

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid tool schema` | `anyOf`/`allOf` in MCP server definition | Update MCP server schema to use simple types |
| `Unauthorized` / `Forbidden` | Wrong credentials in connection | Verify connection credentials match server requirements |
| Model never calls MCP tool | Misconfigured server_label/url | Check `server_label`, `server_url`, `allowed_tools` values |
| Agent stalls after approval | Missing `previous_response_id` | Include `previous_response_id` in follow-up request |
| Timeout | Server takes >100s | Optimize server-side logic or break into smaller operations |
