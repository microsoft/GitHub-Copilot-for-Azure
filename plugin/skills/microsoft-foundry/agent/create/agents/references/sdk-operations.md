# SDK Operations for Foundry Agent Service

Python code samples using `azure-ai-projects` v2.x (preview) for agent CRUD operations. Use these when MCP tools are unavailable.

## Setup

```bash
pip install azure-ai-projects --pre
pip install azure-identity python-dotenv
az login
```

```python
import os
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

load_dotenv()
project_client = AIProjectClient(
    endpoint=os.environ["PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)
```

## Create a Prompt Agent

```python
from azure.ai.projects.models import PromptAgentDefinition

agent = project_client.agents.create_version(
    agent_name="MyAgent",
    definition=PromptAgentDefinition(
        model=os.environ["MODEL_DEPLOYMENT_NAME"],
        instructions="You are a helpful assistant that answers general questions.",
    ),
)
print(f"Created agent: {agent.name} (id: {agent.id}, version: {agent.version})")
```

## List Agents

```python
agents = project_client.agents.list()
for a in agents:
    print(f"  {a.name} (id: {a.id})")
```

## Get Agent Details

```python
agent = project_client.agents.get(agent_name="MyAgent")
print(f"Agent: {agent.name}, Model: {agent.model}")
```

## Update an Agent

Create a new version with updated configuration:

```python
updated = project_client.agents.create_version(
    agent_name="MyAgent",
    definition=PromptAgentDefinition(
        model=os.environ["MODEL_DEPLOYMENT_NAME"],
        instructions="You are an expert assistant specializing in Azure services.",
    ),
)
print(f"Updated agent: {updated.name} (version: {updated.version})")
```

## Delete an Agent

```python
project_client.agents.delete(agent_name="MyAgent")
print("Agent deleted")
```

## Chat with an Agent

```python
openai_client = project_client.get_openai_client()

# Create a conversation for multi-turn
conversation = openai_client.conversations.create()

response = openai_client.responses.create(
    conversation=conversation.id,
    extra_body={"agent": {"name": "MyAgent", "type": "agent_reference"}},
    input="What is the capital of France?",
)
print(f"Response: {response.output_text}")

# Follow-up in same conversation
response = openai_client.responses.create(
    conversation=conversation.id,
    extra_body={"agent": {"name": "MyAgent", "type": "agent_reference"}},
    input="And what is its population?",
)
print(f"Response: {response.output_text}")
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PROJECT_ENDPOINT` | Foundry project endpoint (`https://<resource>.services.ai.azure.com/api/projects/<project>`) |
| `MODEL_DEPLOYMENT_NAME` | Deployed model name (e.g., `gpt-4.1-mini`) |
| `AGENT_NAME` | Agent name for CRUD operations |
