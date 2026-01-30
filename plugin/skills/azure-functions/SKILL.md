---
name: azure-functions
description: Serverless event-driven compute with Azure Functions - pay-per-execution, auto-scaling, multiple triggers
---

# Azure Functions

Serverless compute for event-driven apps. Pay only for execution time with auto-scaling.

## When to Use

- "Deploy my function to Azure", "Create serverless API"
- Project has `host.json` or `local.settings.json`

## Quick Reference

| CLI | `az functionapp`, `func` |
|-----|--------------------------|
| MCP | `azure__functionapp` → `functionapp_list` |

## Hosting (Use Flex Consumption ⭐)

| Plan | Use Case |
|------|----------|
| Flex Consumption | Default for new projects |
| Premium | Long-running workloads |

**Triggers:** HTTP, Timer, Blob, Queue, Event Grid, Cosmos DB, Service Bus

## Deployment

**Prefer `azd`** - Use `azd up --no-prompt` for automation.

| Runtime | Template |
|---------|----------|
| Node/TS | `functions-quickstart-javascript-azd` |
| Python | `functions-quickstart-python-http-azd` |
| C# | `functions-quickstart-dotnet-azd` |

## References

- [CLI commands, deployment](references/CLI-COMMANDS.md)
- [Templates, azd workflows](references/TEMPLATES.md)
- [Code examples, CI/CD](references/EXAMPLES.md)
- [Troubleshooting](references/TROUBLESHOOTING.md)
- [Azure Functions Docs](https://learn.microsoft.com/azure/azure-functions/)
