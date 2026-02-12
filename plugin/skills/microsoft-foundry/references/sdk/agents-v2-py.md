# Hosted Agents v2 — Python SDK Quick Reference

> Condensed from **agents-v2-py**. Full patterns (ImageBasedHostedAgentDefinition,
> container agents, capability hosts, protocol versions)
> in the **agents-v2-py** plugin skill if installed.

## Install
pip install azure-ai-projects>=2.0.0b3 azure-identity

## Quick Start
```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
client = AIProjectClient(endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"], credential=DefaultAzureCredential())
```

## Best Practices
- Version your images — use specific tags, not `latest` in production
- Minimal resources — start with minimum CPU/memory, scale up as needed
- Environment variables — use for all configuration, never hardcode
- Error handling — wrap agent creation in try/except blocks
- Cleanup — delete unused agent versions to free resources

## Non-Obvious Patterns
```python
# Minimum SDK version 2.0.0b3 required for ImageBasedHostedAgentDefinition
# Requires: ACR pull permissions, capability host with enablePublicHostingEnvironment=true
```
