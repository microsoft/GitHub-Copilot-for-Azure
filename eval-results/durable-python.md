# Durable Functions Recipe Evaluation

**Date:** 2026-02-19T04:56:00Z
**Recipe:** durable
**Language:** Python
**Status:** ✅ PASS (after fix)

## Deployment

| Property | Value |
|----------|-------|
| Function App | `func-api-x7xtff7z2udxe` |
| Resource Group | `rg-durable-func-dev` |
| Region | eastus2 |
| Base Template | `functions-quickstart-python-http-azd` |

## Root Cause of Initial Failure

The base HTTP template doesn't include the Storage Queue and Table settings needed for Durable Functions:

### Missing App Settings (CRITICAL)
```
AzureWebJobsStorage__queueServiceUri=https://<storage>.queue.core.windows.net/
AzureWebJobsStorage__tableServiceUri=https://<storage>.table.core.windows.net/
```

### Missing RBAC Roles (CRITICAL)
- `Storage Queue Data Contributor` 
- `Storage Table Data Contributor`

## Test Results (After Fix)

### Health Endpoint
```json
{"status": "healthy", "type": "durable"}
```

### Start Orchestration
```json
{
  "id": "0fe900e532dc4c11912eb31e65e822dc",
  "statusQueryGetUri": "https://..."
}
```

### Orchestration Completed
```json
{
  "runtimeStatus": "Completed",
  "output": ["Hello Seattle", "Hello Tokyo", "Hello London"]
}
```

## Code Requirements

Must use `df.DFApp()` instead of `func.FunctionApp()`:
```python
import azure.durable_functions as df
app = df.DFApp(http_auth_level=func.AuthLevel.FUNCTION)
```

## Verdict

✅ **PASS** - Durable recipe works after adding:
1. Queue and Table service URIs to app settings
2. Queue and Table RBAC roles to managed identity
3. Using `df.DFApp()` instead of `func.FunctionApp()`

## Action Items
- [ ] Update durable recipe README with required app settings
- [ ] Add IaC module to set Queue/Table URIs and RBAC roles
