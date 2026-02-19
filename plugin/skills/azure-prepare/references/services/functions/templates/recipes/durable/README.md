# Durable Functions Recipe

Adds Durable Functions orchestration patterns to an Azure Functions base template.

## Overview

This recipe composes with any HTTP base template to create a Durable Functions app with:
- **Orchestrator** - Coordinates workflow execution
- **Activity** - Individual task units
- **HTTP Client** - Starts and queries orchestrations

No additional Azure resources required — uses the existing Storage account for state management.

## Integration Type

| Aspect | Value |
|--------|-------|
| **Trigger** | `OrchestrationTrigger` + `ActivityTrigger` |
| **Client** | `DurableClient` / `DurableOrchestrationClient` |
| **Auth** | N/A — internal orchestration |
| **IaC** | ❌ None required (uses base Storage) |

## Composition Steps

Apply these steps AFTER `azd init -t functions-quickstart-{lang}-azd`:

| # | Step | Details |
|---|------|---------|
| 1 | **Add extension** | Add Durable Functions extension package |
| 2 | **Replace source code** | Add Orchestrator + Activity + Client from `source/{lang}.md` |
| 3 | **Configure host.json** | Optional: tune concurrency settings |

## Extension Packages

| Language | Package |
|----------|---------|
| Python | `azure-functions-durable` |
| TypeScript/JavaScript | `durable-functions` |
| C# (.NET) | `Microsoft.Azure.Functions.Worker.Extensions.DurableTask` |
| Java | `com.microsoft:durabletask-azure-functions` |
| PowerShell | Built-in (v2 bundles) |

## Files

| Path | Description |
|------|-------------|
| `source/python.md` | Python Durable Functions source code |
| `source/typescript.md` | TypeScript Durable Functions source code |
| `source/javascript.md` | JavaScript Durable Functions source code |
| `source/dotnet.md` | C# (.NET) Durable Functions source code |

## Patterns Included

### Fan-out/Fan-in (Default)

```
HTTP Start → Orchestrator → [Activity1, Activity2, Activity3] → Aggregate → Return
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orchestrators/{name}` | POST | Start new orchestration |
| `/api/status/{instanceId}` | GET | Check orchestration status |
| `/api/health` | GET | Health check |

## Common Issues

### Storage Connection Error

**Cause:** `AzureWebJobsStorage` not configured.

**Solution:** Ensure Storage account connection is set. Durable Functions requires Storage for state persistence.

### Orchestrator Replay Issues

**Cause:** Non-deterministic code in orchestrator (e.g., `DateTime.Now`, random values).

**Solution:** Use `context.current_utc_datetime` or `context.CurrentUtcDateTime` instead.

## host.json Configuration (Optional)

```json
{
  "extensions": {
    "durableTask": {
      "maxConcurrentActivityFunctions": 10,
      "maxConcurrentOrchestratorFunctions": 5
    }
  }
}
```
