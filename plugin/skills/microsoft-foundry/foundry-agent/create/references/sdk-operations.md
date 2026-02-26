# SDK Operations for Foundry Agent Service

Use the Foundry MCP tools for agent CRUD operations. When MCP tools are unavailable, use the `azure-ai-projects` Python SDK or REST API.

## Agent Operations via MCP

| Operation | MCP Tool | Description |
|-----------|----------|-------------|
| Create agent | `foundry_agents_create` | Create a new agent with model and instructions |
| List agents | `foundry_agents_list` | List all agents in the project |
| Get agent | `foundry_agents_connect` | Get details of a specific agent |
| Update agent | `foundry_agents_update` | Update agent configuration (creates new version) |
| Delete agent | `foundry_agents_delete` | Delete an agent |

## SDK Agent Operations

When MCP tools are unavailable, use the `azure-ai-projects` Python SDK (`pip install azure-ai-projects --pre`):

| Operation | SDK Method |
|-----------|------------|
| Create | `project_client.agents.create_version(agent_name, definition)` |
| List | `project_client.agents.list()` |
| Get | `project_client.agents.get(agent_name)` |
| Update | `project_client.agents.create_version(agent_name, definition)` (creates new version) |
| Delete | `project_client.agents.delete(agent_name)` |
| Chat | `openai_client.responses.create(input, extra_body={"agent": {"name": agent_name, "type": "agent_reference"}})` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PROJECT_ENDPOINT` | Foundry project endpoint (`https://<resource>.services.ai.azure.com/api/projects/<project>`) |
| `MODEL_DEPLOYMENT_NAME` | Deployed model name (e.g., `gpt-4.1-mini`) |

## References

- [Agent quickstart](https://learn.microsoft.com/azure/ai-foundry/agents/quickstart?view=foundry)
- [Create agents](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/create-agent?view=foundry)
- [Tool Catalog](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/tool-catalog?view=foundry)
