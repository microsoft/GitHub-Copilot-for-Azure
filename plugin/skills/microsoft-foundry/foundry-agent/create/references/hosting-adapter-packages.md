# Hosting Adapter Packages

Use these packages to wrap an existing agent entrypoint with the Foundry hosting adapter. Get the latest version from the package registry - do not hardcode versions.

## Python

| Framework | Protocol | Package(s) |
|-----------|----------|------------|
| Microsoft Agent Framework | `responses` | `agent-framework-foundry-hosting` |
| Microsoft Agent Framework | `invocations` | `agent-framework-foundry-hosting` |
| LangGraph | `responses` | `azure-ai-agentserver-responses` + `azure-ai-agentserver-core` |
| LangGraph | `invocations` | `azure-ai-agentserver-invocations` + `azure-ai-agentserver-core` |
| Custom | `responses` | `azure-ai-agentserver-responses` |
| Custom | `invocations` | `azure-ai-agentserver-invocations` |

For Python, also add `python-dotenv` if not present so the project can load `.env` during local development.

## .NET

| Framework | Protocol | Package(s) |
|-----------|----------|------------|
| Microsoft Agent Framework | `responses` | `Microsoft.Agents.AI.Foundry.Hosting` |
| Microsoft Agent Framework | `invocations` | `Microsoft.Agents.AI.Foundry.Hosting` + `Azure.AI.AgentServer.Invocations` |
| Custom | `responses` | `Azure.AI.AgentServer.Responses` |
| Custom | `invocations` | `Azure.AI.AgentServer.Invocations` |

## Installation Notes

- Add the package to the project's dependency file (`requirements.txt`, `pyproject.toml`, or `.csproj`).
- LangGraph is **Python only**. For C# + LangGraph, switch to Microsoft Agent Framework or Custom.
- The adapter MUST be the default entrypoint (no flags required to start). This is required for both `azd ai agent run` and containerized deployment.
