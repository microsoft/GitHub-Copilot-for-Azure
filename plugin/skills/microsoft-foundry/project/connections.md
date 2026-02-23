# Foundry Project Connections

Connections authenticate and link external resources to a Foundry project. Many agent tools (Azure AI Search, Bing Grounding, MCP) require a project connection before use.

## List Connections

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

project_client = AIProjectClient(
    endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)
with project_client:
    for conn in project_client.connections.list():
        print(f"  {conn.name} (type: {conn.connection_type})")
```

## Get Connection by Name

```python
conn = project_client.connections.get("my-connection-name")
print(f"ID: {conn.id}")
print(f"Type: {conn.connection_type}")
```

The `conn.id` is the value you pass as `project_connection_id` when configuring tools.

## Create Connection via Azure CLI

### Azure AI Search (key-based)

```yaml
# connection.yml
name: my-search-connection
type: azure_ai_search
endpoint: https://my-search.search.windows.net/
api_key: <your-api-key>
```

### Azure AI Search (keyless / Entra ID)

```yaml
# connection.yml
name: my-search-connection-keyless
type: azure_ai_search
endpoint: https://my-search.search.windows.net/
```

### Bing Grounding

```yaml
# connection.yml
name: my-bing-connection
type: bing
api_key: <your-bing-resource-key>
```

### Apply Connection

```bash
az ml connection create \
  --file connection.yml \
  --resource-group <resource-group> \
  --workspace-name <project-name>
```

## Create Connection via Portal

1. Open [Microsoft Foundry portal](https://ai.azure.com)
2. Navigate to **Operate** → **Admin** → select your project
3. Select **Add connection** → choose service type
4. Browse for resource, select auth method, click **Add connection**

## Verify Connection Exists

```python
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

project_client = AIProjectClient(
    endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)
with project_client:
    try:
        conn = project_client.connections.get("my-connection-name")
        print(f"Connection verified: {conn.name}")
        print(f"Connection ID: {conn.id}")
    except Exception as e:
        print(f"Connection not found: {e}")
        print("Available connections:")
        for c in project_client.connections.list():
            print(f"  - {c.name}")
```

## Connection ID Format

For REST and TypeScript samples, the full connection ID format is:

```
/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}/connections/{connectionName}
```

Python and C# SDKs resolve this automatically from the connection name.

## Common Connection Types

| Type | Resource | Used By |
|------|----------|---------|
| `azure_ai_search` | Azure AI Search | AI Search tool |
| `bing` | Grounding with Bing Search | Bing grounding tool |
| `bing_custom_search` | Grounding with Bing Custom Search | Bing Custom Search tool |
| `api_key` | Any API-key resource | MCP servers, custom tools |
| `azure_openai` | Azure OpenAI | Model access |

## RBAC for Connection Management

| Role | Scope | Permission |
|------|-------|------------|
| **Azure AI Project Manager** | Project | Create/manage project connections |
| **Contributor** or **Owner** | Subscription/RG | Create Bing/Search resources, get keys |

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Connection not found` | Name mismatch or wrong project | List connections to find correct name |
| `Unauthorized` creating connection | Missing Azure AI Project Manager role | Assign role on the Foundry project |
| `Invalid connection ID format` | Using name instead of full resource ID | Use SDK `connections.get(name).id` to resolve |
