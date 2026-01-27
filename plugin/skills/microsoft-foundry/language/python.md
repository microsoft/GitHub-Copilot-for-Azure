# Microsoft Foundry - Python SDK Guide

This guide provides Python-specific implementations for working with Microsoft Foundry.

## Prerequisites

### Python Environment
- **Python 3.8+** required
- **pip** package manager

### Python Package Installation

```bash
# Core packages for Microsoft Foundry
pip install azure-ai-projects azure-identity azure-ai-inference openai

# For evaluation
pip install azure-ai-evaluation

# For environment management (recommended)
pip install python-dotenv
```

### Authentication

Always use `DefaultAzureCredential` from `azure.identity`:

```python
from azure.identity import DefaultAzureCredential

# This works with:
# - Azure CLI (az login)
# - Managed Identity (when running in Azure)
# - Environment variables
# - VS Code authentication
credential = DefaultAzureCredential()
```

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Foundry Project
PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
MODEL_DEPLOYMENT_NAME=gpt-4o

# Azure AI Search (for RAG)
AZURE_AI_SEARCH_CONNECTION_NAME=my-search-connection
AI_SEARCH_INDEX_NAME=my-index

# Evaluation
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

## Model Discovery and Deployment

### Using MCP Tools in Python

```python
# List all available models
foundry_models_list()

# List models that support free playground
foundry_models_list(search_for_free_playground=True)

# Filter by publisher
foundry_models_list(publisher="OpenAI")

# Deploy a model
foundry_models_deploy(
    resource_group="my-resource-group",
    deployment="gpt-4o-deployment",
    model_name="gpt-4o",
    model_format="OpenAI",
    azure_ai_services="my-foundry-resource",
    model_version="2024-05-13",
    sku_capacity=10,
    scale_type="Standard"
)

# Get resource details
foundry_resource_get(
    resource_name="my-foundry-resource",
    resource_group="my-resource-group"
)
```

## RAG Applications with Python SDK

### Complete RAG Agent Example

```python
import os
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.agents.models import (
    AzureAISearchToolDefinition,
    AzureAISearchToolResource,
    AISearchIndexResource,
    AzureAISearchQueryType,
)

load_dotenv()

# Create project client
project_client = AIProjectClient(
    endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

openai_client = project_client.get_openai_client()

# Get Azure AI Search connection
azs_connection = project_client.connections.get(
    os.environ["AZURE_AI_SEARCH_CONNECTION_NAME"]
)
connection_id = azs_connection.id

# Create agent with Azure AI Search tool
agent = project_client.agents.create_agent(
    model=os.environ["FOUNDRY_MODEL_DEPLOYMENT_NAME"],
    name="RAGAgent",
    instructions="""You are a helpful assistant that uses the knowledge base 
    to answer questions. You must always provide citations using the tool 
    and render them as: `[message_idx:search_idx†source]`. 
    If you cannot find the answer in the knowledge base, say "I don't know".""",
    tools=[
        AzureAISearchToolDefinition(
            azure_ai_search=AzureAISearchToolResource(
                indexes=[
                    AISearchIndexResource(
                        index_connection_id=connection_id,
                        index_name=os.environ["AI_SEARCH_INDEX_NAME"],
                        query_type=AzureAISearchQueryType.HYBRID,
                    ),
                ]
            )
        )
    ],
)

print(f"Agent created: {agent.name} (ID: {agent.id})")
```

### Testing the RAG Agent

```python
# Query the agent
user_query = input("Ask a question: ")

stream_response = openai_client.responses.create(
    stream=True,
    tool_choice="required",
    input=user_query,
    extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
)

# Process streaming response
for event in stream_response:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
    elif event.type == "response.output_item.done":
        if event.item.type == "message":
            item = event.item
            if item.content[-1].type == "output_text":
                text_content = item.content[-1]
                for annotation in text_content.annotations:
                    if annotation.type == "url_citation":
                        print(f"\n📎 Citation: {annotation.url}")
    elif event.type == "response.completed":
        print("\n✅ Response complete")
```

### Update Agent Instructions

```python
# Update agent to request citations properly
updated_agent = project_client.agents.update_agent(
    agent_id=agent.id,
    model=os.environ["MODEL_DEPLOYMENT_NAME"],
    instructions="""You are a helpful assistant. You must always provide 
    citations using the tool and render them as: `[message_idx:search_idx†source]`. 
    Never answer from your own knowledge - only use the knowledge base.""",
    tools=original_tools
)
```

## Creating AI Agents with Python SDK

### Basic Agent

```python
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

# Create project client
project_client = AIProjectClient(
    endpoint=os.environ["PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

# Create a simple agent
agent = project_client.agents.create_agent(
    model=os.environ["MODEL_DEPLOYMENT_NAME"],
    name="my-helpful-agent",
    instructions="You are a helpful assistant that can answer questions clearly and concisely.",
)

print(f"Created agent with ID: {agent.id}")
```

### Agent with Custom Function Tools

```python
from azure.ai.agents.models import FunctionTool, ToolSet

# Define custom functions
def get_weather(location: str, unit: str = "celsius") -> str:
    """Get the current weather for a location.
    
    Args:
        location: The city and state, e.g., 'San Francisco, CA'
        unit: Temperature unit, either 'celsius' or 'fahrenheit'
    """
    # Mock implementation
    return f"The weather in {location} is sunny and 22°{unit[0].upper()}"

def search_database(query: str) -> str:
    """Search the product database.
    
    Args:
        query: Search query string
    """
    # Mock implementation
    return f"Found 3 products matching '{query}'"

# Create function toolset
user_functions = [get_weather, search_database]
functions = FunctionTool(user_functions)
toolset = ToolSet()
toolset.add(functions)

# Create agent with tools
agent = project_client.agents.create_agent(
    model=os.environ["MODEL_DEPLOYMENT_NAME"],
    name="function-agent",
    instructions="You are a helpful assistant with access to weather and product database tools. Use them to help users.",
    toolset=toolset
)

print(f"Created agent with function tools: {agent.id}")
```

### Agent with Web Search

```python
from azure.ai.agents.models import BingGroundingToolDefinition

# Create agent with web search capability
agent = project_client.agents.create_agent(
    model=os.environ["MODEL_DEPLOYMENT_NAME"],
    name="WebSearchAgent",
    instructions="You are a helpful assistant that can search the web for current information. Always provide sources for web-based answers.",
    tools=[
        BingGroundingToolDefinition()
    ],
)

print(f"Web search agent created: {agent.name} (ID: {agent.id})")
```

### Interacting with Agents

```python
from azure.ai.agents.models import ListSortOrder

# Create a conversation thread
thread = project_client.agents.threads.create()
print(f"Created thread: {thread.id}")

# Add user message
message = project_client.agents.messages.create(
    thread_id=thread.id,
    role="user",
    content="What's the weather in Seattle and what products do you have for rain?"
)

# Run the agent
run = project_client.agents.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id
)

# Check run status
if run.status == "failed":
    print(f"❌ Run failed: {run.last_error}")
else:
    print("✅ Run completed successfully")

# Get and display messages
messages = project_client.agents.messages.list(
    thread_id=thread.id,
    order=ListSortOrder.ASCENDING
)

for msg in messages:
    if msg.text_messages:
        print(f"\n{msg.role.upper()}: {msg.text_messages[-1].text.value}")

# Cleanup
project_client.agents.delete_agent(agent.id)
print("\n🧹 Agent deleted")
```

## Agent Evaluation with Python SDK

### Single Response Evaluation Using MCP

```python
# Query an agent and evaluate in one call
foundry_agents_query_and_evaluate(
    agent_id="<agent-id>",
    query="What's the weather in Seattle?",
    endpoint="https://my-foundry.services.ai.azure.com/api/projects/my-project",
    azure_openai_endpoint="https://my-openai.openai.azure.com",
    azure_openai_deployment="gpt-4o",
    evaluators="intent_resolution,task_adherence,tool_call_accuracy"
)

# Evaluate existing response
foundry_agents_evaluate(
    query="What's the weather in Seattle?",
    response="The weather in Seattle is sunny and 22°C.",
    evaluator="intent_resolution",
    azure_openai_endpoint="https://my-openai.openai.azure.com",
    azure_openai_deployment="gpt-4o"
)
```

### Batch Evaluation

```python
import os
import json
from azure.ai.evaluation import AIAgentConverter, IntentResolutionEvaluator, evaluate
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

# Initialize project client
project_client = AIProjectClient(
    endpoint=os.environ["PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential()
)

# Convert agent thread data to evaluation format
converter = AIAgentConverter(project_client)

# Prepare evaluation data from multiple threads
thread_ids = ["thread-1", "thread-2", "thread-3"]
filename = "evaluation_input_data.jsonl"

evaluation_data = converter.prepare_evaluation_data(
    thread_ids=thread_ids,
    filename=filename
)

print(f"Evaluation data saved to {filename}")

# Set up evaluators
evaluators = {
    "intent_resolution": IntentResolutionEvaluator(
        azure_openai_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        azure_openai_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"]
    ),
    # Add other evaluators as needed
}

# Run batch evaluation
result = evaluate(
    data=filename,
    evaluators=evaluators,
    output_path="./evaluation_results"
)

print(f"Evaluation complete. View results at: {result['studio_url']}")
```

### Continuous Evaluation Setup

```python
# Note: Continuous evaluation setup requires configuration through 
# the Azure AI Foundry portal or using the azure-ai-evaluation SDK.
# The evaluation rules API is configured at the project level.

# Example using azure-ai-evaluation for setting up evaluators
from azure.ai.evaluation import IntentResolutionEvaluator, TaskAdherenceEvaluator

# Initialize evaluators for use in your evaluation pipeline
intent_evaluator = IntentResolutionEvaluator(
    azure_openai_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_openai_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"]
)

task_evaluator = TaskAdherenceEvaluator(
    azure_openai_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_openai_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"]
)

print("Evaluators initialized for continuous evaluation")
```

**Prerequisites for Continuous Evaluation:**
- Project managed identity must have **Azure AI User** role
- Application Insights must be connected to the project

### Checking Evaluation Status

```python
# List evaluation runs to check status
eval_runs = project_client.evaluations.runs.list(
    eval_id=eval_rule.id,
    order="desc",
    limit=10
)

for run in eval_runs.data:
    print(f"Run ID: {run.id}, Status: {run.status}")
    if run.report_url:
        print(f"Report: {run.report_url}")
```

## Knowledge Index Operations

### List and Inspect Indexes Using MCP

```python
# List all knowledge indexes in a project
foundry_knowledge_index_list(
    endpoint="https://my-foundry.services.ai.azure.com/api/projects/my-project"
)

# Get detailed schema for a specific index
foundry_knowledge_index_schema(
    endpoint="https://my-foundry.services.ai.azure.com/api/projects/my-project",
    index="my-knowledge-index"
)
```

## Best Practices for Python

1. **Use environment variables**: Never hardcode credentials or endpoints
2. **Use .env files**: Leverage `python-dotenv` for local development
3. **Proper error handling**: Always check `run.status` and handle exceptions
4. **Context managers**: Use `with` statements for proper resource cleanup
5. **Type hints**: Use type hints in custom functions for better tool integration
6. **Async operations**: Consider async versions of SDK methods for better performance
7. **Connection pooling**: Reuse `AIProjectClient` instances instead of creating new ones

## Example: Complete RAG Application

```python
import os
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.agents.models import (
    AzureAISearchToolDefinition,
    AzureAISearchToolResource,
    AISearchIndexResource,
    AzureAISearchQueryType,
    ListSortOrder,
)

load_dotenv()

def create_rag_agent():
    """Create a RAG agent with Azure AI Search."""
    project_client = AIProjectClient(
        endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
        credential=DefaultAzureCredential(),
    )
    
    # Get Azure AI Search connection
    azs_connection = project_client.connections.get(
        os.environ["AZURE_AI_SEARCH_CONNECTION_NAME"]
    )
    
    # Create agent
    agent = project_client.agents.create_agent(
        model=os.environ["FOUNDRY_MODEL_DEPLOYMENT_NAME"],
        name="RAGAgent",
        instructions="""You are a helpful assistant that uses the knowledge base 
        to answer questions. Always provide citations as: `[message_idx:search_idx†source]`. 
        If you cannot find the answer, say "I don't know".""",
        tools=[
            AzureAISearchToolDefinition(
                azure_ai_search=AzureAISearchToolResource(
                    indexes=[
                        AISearchIndexResource(
                            index_connection_id=azs_connection.id,
                            index_name=os.environ["AI_SEARCH_INDEX_NAME"],
                            query_type=AzureAISearchQueryType.HYBRID,
                        ),
                    ]
                )
            )
        ],
    )
    
    return project_client, agent

def query_agent(project_client, agent, query):
    """Query the agent and return response with citations."""
    openai_client = project_client.get_openai_client()
    
    stream_response = openai_client.responses.create(
        stream=True,
        tool_choice="required",
        input=query,
        extra_body={"agent": {"name": agent.name, "type": "agent_reference"}},
    )
    
    response_text = ""
    citations = []
    
    for event in stream_response:
        if event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)
            response_text += event.delta
        elif event.type == "response.output_item.done":
            if event.item.type == "message":
                item = event.item
                if item.content[-1].type == "output_text":
                    text_content = item.content[-1]
                    for annotation in text_content.annotations:
                        if annotation.type == "url_citation":
                            citations.append(annotation.url)
    
    return response_text, citations

def main():
    """Main application entry point."""
    print("Creating RAG agent...")
    project_client, agent = create_rag_agent()
    print(f"✅ Agent created: {agent.name} (ID: {agent.id})\n")
    
    while True:
        query = input("\nAsk a question (or 'quit' to exit): ")
        if query.lower() in ['quit', 'exit', 'q']:
            break
        
        print("\nAgent response:")
        response, citations = query_agent(project_client, agent, query)
        
        if citations:
            print("\n\n📎 Citations:")
            for i, citation in enumerate(citations, 1):
                print(f"  {i}. {citation}")
    
    # Cleanup
    print("\n\n🧹 Cleaning up...")
    project_client.agents.delete_agent(agent.id)
    print("Done!")

if __name__ == "__main__":
    main()
```

## Common Python Patterns

### Error Handling

```python
from azure.core.exceptions import HttpResponseError

try:
    agent = project_client.agents.create_agent(
        model=os.environ["MODEL_DEPLOYMENT_NAME"],
        name="my-agent",
        instructions="You are helpful."
    )
except HttpResponseError as e:
    if e.status_code == 429:
        print("Rate limit exceeded. Please wait and retry.")
    elif e.status_code == 401:
        print("Authentication failed. Check your credentials.")
    else:
        print(f"Error: {e.message}")
```

### Retry Logic

```python
import time
from azure.core.exceptions import HttpResponseError

def create_agent_with_retry(project_client, max_retries=3):
    """Create agent with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            agent = project_client.agents.create_agent(
                model=os.environ["MODEL_DEPLOYMENT_NAME"],
                name="my-agent",
                instructions="You are helpful."
            )
            return agent
        except HttpResponseError as e:
            if e.status_code == 429 and attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Rate limited. Waiting {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                raise
    
    raise Exception("Failed to create agent after retries")
```

### Context Manager for Cleanup

```python
from contextlib import contextmanager

@contextmanager
def temporary_agent(project_client, **agent_kwargs):
    """Context manager for temporary agents that auto-cleanup."""
    agent = project_client.agents.create_agent(**agent_kwargs)
    try:
        yield agent
    finally:
        project_client.agents.delete_agent(agent.id)
        print(f"Agent {agent.id} cleaned up")

# Usage
with temporary_agent(
    project_client,
    model=os.environ["MODEL_DEPLOYMENT_NAME"],
    name="temp-agent",
    instructions="You are helpful."
) as agent:
    # Use the agent
    thread = project_client.agents.threads.create()
    # ... do work ...
# Agent is automatically deleted when exiting the with block
```
