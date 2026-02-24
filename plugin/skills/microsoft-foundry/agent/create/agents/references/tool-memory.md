# Agent Memory

Managed long-term memory for Foundry agents. Enables agent continuity across sessions, devices, and workflows. Agents retain user preferences, conversation history, and deliver personalized experiences. Memory is stored in your project's owned storage.

## Prerequisites

- A [Foundry project](https://learn.microsoft.com/azure/ai-foundry/how-to/create-projects) with authorization configured
- A **chat model deployment** (e.g., `gpt-5.2`)
- An **embedding model deployment** (e.g., `text-embedding-3-small`) — see [Check Embedding Model](#check-embedding-model) below
- Python packages: `pip install azure-ai-projects azure-identity`

### Check Embedding Model

An embedding model is **required** before enabling memory. Check if one is already deployed:

**Using MCP Tools (preferred):**

Use `foundry-mcp-model_deployment_get` with the Foundry account resource ID to list all deployments. Look for an embedding model (e.g., `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`).

**Using Azure CLI:**

```bash
az cognitiveservices account deployment list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query "[?contains(properties.model.name, 'embedding')].{Name:name, Model:properties.model.name, Version:properties.model.version}" \
  -o table
```

| Result | Action |
|--------|--------|
| ✅ Embedding model found | Note the deployment name and proceed |
| ❌ No embedding model | Deploy one before enabling memory — see below |

### Deploy Embedding Model

If no embedding model exists, deploy one:

**Using MCP Tools (preferred):**

Use `foundry-mcp-model_deploy` with:
- `deploymentName`: `text-embedding-3-small` (or preferred name)
- `modelName`: `text-embedding-3-small`
- `modelFormat`: `OpenAI`

**Using Azure CLI:**

```bash
az cognitiveservices account deployment create \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name text-embedding-3-small \
  --model-name text-embedding-3-small \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name Standard
```

## Authorization and Permissions

| Role | Scope | Purpose |
|------|-------|---------|
| **Azure AI User** | AI Services resource | Assigned to project managed identity |
| **System-assigned managed identity** | Project | Must be enabled on the project |

**Setup steps:**
1. In Azure portal → project → **Resource Management** → **Identity** → enable system-assigned managed identity
2. On the AI Services resource → **Access control (IAM)** → assign **Azure AI User** to the project managed identity

## Workflow

```
User wants agent memory
    │
    ▼
Step 1: Check for embedding model deployment
    │  ├─ ✅ Found → Continue
    │  └─ ❌ Not found → Deploy one (ask user)
    │
    ▼
Step 2: Create memory store
    │
    ▼
Step 3: Attach memory tool to agent
    │
    ▼
Step 4: Test with conversation
```

## Create Memory Store

```python
import os
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import MemoryStoreDefaultDefinition, MemoryStoreDefaultOptions
from azure.identity import DefaultAzureCredential

project_client = AIProjectClient(
    endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

options = MemoryStoreDefaultOptions(
    chat_summary_enabled=True,
    user_profile_enabled=True,
    user_profile_details="Avoid sensitive data such as age, financials, location, credentials"
)

memory_store = project_client.memory_stores.create(
    name="my_memory_store",
    definition=MemoryStoreDefaultDefinition(
        chat_model="gpt-5.2",
        embedding_model="text-embedding-3-small",
        options=options,
    ),
    description="Memory store for agent",
)
```

> 💡 **Tip:** Use `user_profile_details` to control what the agent stores — e.g., `"flight carrier preference and dietary restrictions"` for a travel agent, or exclude sensitive data.

## Attach Memory to Agent

```python
from azure.ai.projects.models import MemorySearchTool, PromptAgentDefinition

tool = MemorySearchTool(
    memory_store_name="my_memory_store",
    scope="{{$userId}}",  # auto-extracts TID+OID from auth header
    update_delay=300,      # 5 minutes of inactivity before updating
)

agent = project_client.agents.create_version(
    agent_name="MemoryAgent",
    definition=PromptAgentDefinition(
        model="gpt-5.2",
        instructions="You are a helpful assistant that remembers user preferences.",
        tools=[tool],
    ),
)
```

### Scope

The `scope` parameter partitions memory per user. Options:

| Scope Value | Behavior |
|-------------|----------|
| `{{$userId}}` | Auto-extracts TID+OID from auth token (recommended) |
| `"user_123"` | Static identifier — you manage user mapping |

## Manage Memory Stores

```python
# List memory stores
stores = project_client.memory_stores.list()

# Update description
project_client.memory_stores.update(name="my_memory_store", description="Updated")

# Delete memories for a scope
project_client.memory_stores.delete_scope(name="my_memory_store", scope="user_123")

# Delete entire memory store (irreversible)
project_client.memory_stores.delete("my_memory_store")
```

> ⚠️ **Warning:** Deleting a memory store removes all memories across all scopes. Agents with attached memory stores lose access to historical context.

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Auth/authorization error | Identity or managed identity lacks required roles | Verify roles in Authorization section; refresh access token for REST |
| Memories don't appear after conversation | Updates are debounced or still processing | Increase wait time or call update API with `update_delay=0` |
| Memory search returns no results | Scope mismatch between update and search | Use same scope value for storing and retrieving memories |
| Agent response ignores stored memory | Agent not configured with memory search tool | Confirm agent definition includes `MemorySearchTool` with correct store name |
| No embedding model available | Embedding deployment missing | Deploy an embedding model — see Check Embedding Model section |

## References

- [Memory Usage Guide](https://learn.microsoft.com/azure/ai-foundry/agents/how-to/memory-usage)
- [Memory Concepts](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/what-is-memory)
- [Python Samples](https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/ai/azure-ai-projects/samples/memories)
