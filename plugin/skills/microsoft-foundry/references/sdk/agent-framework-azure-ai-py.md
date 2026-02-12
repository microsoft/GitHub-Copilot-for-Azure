# Agent Framework — Python SDK Quick Reference

> Condensed from **agent-framework-azure-ai-py**. Full patterns (hosted tools,
> MCP integration, function tools, structured outputs, streaming)
> in the **agent-framework-azure-ai-py** plugin skill if installed.

## Install
pip install agent-framework-azure-ai --pre

## Quick Start
```python
from agent_framework_azure_ai import AzureAIAgentsProvider
from azure.identity.aio import DefaultAzureCredential
provider = AzureAIAgentsProvider(endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"], credential=DefaultAzureCredential())
```

## Best Practices
- Use `agent-framework` (full package) for most scenarios
- Use AzureCliCredential for development, DefaultAzureCredential for production
- Always close async credentials and providers
- Use connection IDs (not names) for tool configurations like Bing search
- Clean up agents and threads when done to free resources
- Use streaming for real-time user experiences
