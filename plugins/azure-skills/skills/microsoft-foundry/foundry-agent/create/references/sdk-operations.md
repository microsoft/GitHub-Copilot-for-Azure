# SDK Operations for Foundry Agent Service

Use the Foundry MCP tools for agent CRUD operations. When MCP tools are unavailable, use the `azure-ai-projects` Python SDK or REST API.

## Agent Operations via MCP

| Operation | MCP Tool | Description |
|-----------|----------|-------------|
| Create/Update agent | `agent_update` | Create a new agent or update an existing one (creates new version) |
| List/Get agents | `agent_get` | List all agents, or get a specific agent by name |
| Delete agent | `agent_delete` | Delete an agent |
| Invoke agent | `agent_invoke` | Send a message to an agent and get a response |
| Get schema | `agent_definition_schema_get` | Get the full JSON schema for agent definitions |

## SDK Agent Operations

When MCP tools are unavailable, use the `azure-ai-projects` Python SDK (`pip install azure-ai-projects --pre`):

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

endpoint = "https://<resource>.services.ai.azure.com/api/projects/<project>"
client = AIProjectClient(
    endpoint=endpoint,
    credential=DefaultAzureCredential(),
    allow_preview=True,
)
```

| Operation | SDK Method |
|-----------|------------|
| Create | `client.agents.create_version(agent_name, definition)` |
| List | `client.agents.list()` |
| Get | `client.agents.get(agent_name)` |
| Update | `client.agents.create_version(agent_name, definition)` (creates new version) |
| Delete | `client.agents.delete(agent_name)` |
| Prompt agent chat | `client.get_openai_client().responses.create(input=<text>, extra_body={"agent_reference": {"name": agent_name, "version": agent_version, "type": "agent_reference"}})` |

## Hosted Responses Invocation

For a hosted Responses agent, select its endpoint with `agent_name` on `get_openai_client`, not the project-level model endpoint. With `azure-ai-projects==2.9.0`, this operation requires `allow_preview=True` on `AIProjectClient`, as shown above, not on the OpenAI client. Check the installed SDK contract for other versions.

```python
with client.get_openai_client(agent_name="<deployed-agent-name>") as hosted:
    response = hosted.responses.create(input="<original-user-request>")
```

The client is already bound to the named agent. Record the deployed agent version and response ID. Inspect terminal status/errors and actual tool/file outputs: HTTP 200, initial response creation, and offline transport tests do not establish live completion or runtime authorization.

For later turns, preserve the conversation identity and authenticated caller. When using `previous_response_id` and requiring the same hosted filesystem, also pass the returned `agent_session_id` in the Responses request body with `extra_body={"agent_session_id": session_id}`; it is not a header. A `conversation` automatically associates a stable session. Session continuity is not graph checkpoint persistence. See [Manage hosted agent sessions](https://learn.microsoft.com/azure/foundry/agents/how-to/manage-hosted-sessions) and [invoke](../../invoke/invoke.md).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PROJECT_ENDPOINT` | Foundry project endpoint (`https://<resource>.services.ai.azure.com/api/projects/<project>`) |
| `MODEL_DEPLOYMENT_NAME` | Deployed model name (e.g., `gpt-4.1-mini`) |

## References

- [Agent quickstart](https://learn.microsoft.com/azure/ai-foundry/agents/quickstart?view=foundry)
- [Create agents](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/create-agent?view=foundry)
- [Tool Catalog](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/tool-catalog?view=foundry)
