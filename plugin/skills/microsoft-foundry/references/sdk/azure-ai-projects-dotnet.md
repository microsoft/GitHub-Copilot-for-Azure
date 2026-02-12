# AI Projects — .NET SDK Quick Reference

> Condensed from **azure-ai-projects-dotnet**. Full patterns (versioned agents,
> evaluations, datasets, connections, OpenAI extensions)
> in the **azure-ai-projects-dotnet** plugin skill if installed.

## Install
dotnet add package Azure.AI.Projects Azure.Identity

## Quick Start
```csharp
using Azure.AI.Projects;
using Azure.Identity;
var projectClient = new AIProjectClient(new Uri(endpoint), new DefaultAzureCredential());
```

## Best Practices
- Use DefaultAzureCredential for production authentication
- Use async methods (`*Async`) for all I/O operations
- Poll with appropriate delays (500ms recommended) when waiting for runs
- Clean up resources — delete threads, agents, and files when done
- Use versioned agents (via Azure.AI.Projects.OpenAI) for production scenarios
- Store connection IDs rather than names for tool configurations
- Use `includeCredentials: true` only when credentials are needed
- Handle pagination — use `AsyncPageable<T>` for listing operations
