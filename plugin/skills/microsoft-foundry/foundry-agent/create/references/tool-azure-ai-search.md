# Azure AI Search Tool

Ground agent responses with data from an Azure AI Search vector index. Requires a project connection and proper RBAC setup.

## Prerequisites

- Azure AI Search index with vector search configured:
  - One or more `Edm.String` fields (searchable + retrievable)
  - One or more `Collection(Edm.Single)` vector fields (searchable)
  - At least one retrievable text field with content for citations
  - A retrievable field with source URL for citation links
- A [project connection](../../../project/connections.md) between your Foundry project and search service
- `azure-ai-projects` package (`pip install azure-ai-projects --pre`)

## Required RBAC Roles

For **keyless authentication** (recommended), assign these roles to the **Foundry project's managed identity** on the Azure AI Search resource:

| Role | Scope | Purpose |
|------|-------|---------|
| **Search Index Data Contributor** | AI Search resource | Read/write index data |
| **Search Service Contributor** | AI Search resource | Manage search service config |

### Assign via CLI

```bash
# Get the project managed identity principal ID from the Foundry portal or CLI
SEARCH_RESOURCE_ID="/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Search/searchServices/<search-name>"
PRINCIPAL_ID="<project-managed-identity-object-id>"

az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Search Index Data Contributor" \
  --scope "$SEARCH_RESOURCE_ID"

az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Search Service Contributor" \
  --scope "$SEARCH_RESOURCE_ID"
```

> **If RBAC assignment fails:** Ask the user to manually assign roles in Azure portal → AI Search resource → Access control (IAM). They need Owner or User Access Administrator on the search resource.

## Create the Connection

See [Project Connections](../../../project/connections.md) for full connection CRUD helpers.

**Quick setup (keyless):**
```bash
# connection.yml
cat <<EOF > connection.yml
name: my-search-connection
type: azure_ai_search
endpoint: https://<search-name>.search.windows.net/
EOF

az ml connection create --file connection.yml \
  --resource-group <rg> --workspace-name <project-name>
```

## Environment Variables

```bash
export FOUNDRY_PROJECT_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"
export FOUNDRY_MODEL_DEPLOYMENT_NAME="gpt-4o"
export AZURE_AI_SEARCH_CONNECTION_NAME="my-search-connection"
export AI_SEARCH_INDEX_NAME="my-index"
```

## Full Code Sample

```python
import os
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import (
    AzureAISearchAgentTool,
    PromptAgentDefinition,
    AzureAISearchToolResource,
    AISearchIndexResource,
    AzureAISearchQueryType,
)

load_dotenv()

project_client = AIProjectClient(
    endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)
openai_client = project_client.get_openai_client()

with project_client:
    # Resolve connection ID from name
    azs_connection = project_client.connections.get(
        os.environ["AZURE_AI_SEARCH_CONNECTION_NAME"]
    )
    connection_id = azs_connection.id
    print(f"Connection ID: {connection_id}")

    agent = project_client.agents.create_version(
        agent_name="SearchAgent",
        definition=PromptAgentDefinition(
            model=os.environ["FOUNDRY_MODEL_DEPLOYMENT_NAME"],
            instructions="""You are a helpful assistant. Always provide citations
            using the search tool. Render as: [message_idx:search_idx†source].""",
            tools=[
                AzureAISearchAgentTool(
                    azure_ai_search=AzureAISearchToolResource(
                        indexes=[
                            AISearchIndexResource(
                                project_connection_id=connection_id,
                                index_name=os.environ["AI_SEARCH_INDEX_NAME"],
                                query_type=AzureAISearchQueryType.VECTOR_SEMANTIC_HYBRID,
                            ),
                        ]
                    )
                )
            ],
        ),
    )
    print(f"Agent created: {agent.name} v{agent.version}")

    # Stream a query with citations
    stream = openai_client.responses.create(
        stream=True,
        tool_choice="required",
        input="What services are available?",
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )
    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta, end="")
        elif event.type == "response.output_item.done":
            if event.item.type == "message":
                text = event.item.content[-1]
                if text.type == "output_text":
                    for ann in text.annotations:
                        if ann.type == "url_citation":
                            print(f"\nCitation: {ann.url}")

    # Cleanup
    project_client.agents.delete_version(
        agent_name=agent.name, agent_version=agent.version
    )
```

## Query Types

| Value | Description |
|-------|-------------|
| `SIMPLE` | Keyword search |
| `VECTOR` | Vector similarity only |
| `SEMANTIC` | Semantic ranking |
| `VECTOR_SIMPLE_HYBRID` | Vector + keyword |
| `VECTOR_SEMANTIC_HYBRID` | Vector + keyword + semantic (default, recommended) |

## Tool Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_connection_id` | Yes | Connection ID (resolve via `connections.get(name).id`) |
| `index_name` | Yes | Search index name |
| `top_k` | No | Number of results (default: 5) |
| `query_type` | No | Search type (default: `vector_semantic_hybrid`) |
| `filter` | No | OData filter applied to all queries |

## Limitations

- Only **one index per tool** instance. For multiple indexes, use connected agents each with their own index.
- Search resource and Foundry agent must be in the **same tenant**.
- Private AI Search resources require **standard agent deployment** with vNET injection.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 401/403 accessing index | Missing RBAC roles | Assign `Search Index Data Contributor` + `Search Service Contributor` to project managed identity |
| Index not found | Name mismatch | Verify `AI_SEARCH_INDEX_NAME` matches exactly (case-sensitive) |
| No citations in response | Instructions don't request them | Add citation instructions to agent prompt |
| Wrong connection endpoint | Connection points to different search resource | Re-create connection with correct endpoint |
