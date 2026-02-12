# AI Projects — Python SDK Quick Reference

> Condensed from **azure-ai-projects-py**. Full patterns (agents, versioning,
> threads, streaming, datasets, indexes, evaluations)
> in the **azure-ai-projects-py** plugin skill if installed.

## Install
pip install azure-ai-projects azure-identity

## Quick Start
```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
client = AIProjectClient(endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"], credential=DefaultAzureCredential())
```

## Best Practices
- Use context managers for async client: `async with AIProjectClient(...) as client:`
- Clean up agents when done: `client.agents.delete_agent(agent.id)`
- Use `create_and_process` for simple runs, streaming for real-time UX
- Use versioned agents for production deployments
- Prefer connections for external service integration (AI Search, Bing, etc.)
