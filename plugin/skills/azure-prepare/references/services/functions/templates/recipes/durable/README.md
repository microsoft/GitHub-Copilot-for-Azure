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
| **IaC** | ⚠️ Requires Queue/Table Storage config (see below) |

## ⚠️ CRITICAL: Flex Consumption Requirements

Durable Functions on Flex Consumption with User-Assigned Managed Identity (UAMI) requires **additional Storage configuration** beyond the base HTTP template.

### Required App Settings

The base template only configures Blob storage. Durable Functions also needs Queue and Table storage:

```
AzureWebJobsStorage__blobServiceUri=https://<storage>.blob.core.windows.net/
AzureWebJobsStorage__queueServiceUri=https://<storage>.queue.core.windows.net/  # REQUIRED
AzureWebJobsStorage__tableServiceUri=https://<storage>.table.core.windows.net/  # REQUIRED
AzureWebJobsStorage__credential=managedidentity
AzureWebJobsStorage__clientId=<uami-client-id>
```

### Required RBAC Roles

Add these roles to the UAMI on the Storage account:

| Role | Role ID | Purpose |
|------|---------|---------|
| Storage Blob Data Owner | b7e6dc6d-f1e8-4753-8033-0f276bb0955b | ✅ Base template includes |
| Storage Queue Data Contributor | 974c5e8b-45b9-4653-ba55-5f855dd0fb88 | ⚠️ MUST ADD |
| Storage Table Data Contributor | 0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3 | ⚠️ MUST ADD |

### IaC Addition (main.bicep)

Add to base template's `main.bicep`:

```bicep
// Add to roleAssignments array in storage module
{
  principalId: userAssignedIdentity.properties.principalId
  principalType: 'ServicePrincipal'
  roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88') // Storage Queue Data Contributor
}
{
  principalId: userAssignedIdentity.properties.principalId
  principalType: 'ServicePrincipal'
  roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3') // Storage Table Data Contributor
}

// Add to Function App settings
AzureWebJobsStorage__queueServiceUri: 'https://${storage.name}.queue.${environment().suffixes.storage}/'
AzureWebJobsStorage__tableServiceUri: 'https://${storage.name}.table.${environment().suffixes.storage}/'
```

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

### Storage Connection Error (Flex Consumption with UAMI)

**Symptoms:** 503 "Function host is not running", or "Storage Queue connection failed"

**Cause:** Missing Queue/Table storage URIs and RBAC roles.

**Solution:** 
1. Add `AzureWebJobsStorage__queueServiceUri` and `AzureWebJobsStorage__tableServiceUri` app settings
2. Add `Storage Queue Data Contributor` and `Storage Table Data Contributor` RBAC roles to UAMI

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
