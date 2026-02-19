# Durable Functions Recipe Evaluation

**Date:** 2026-02-19T04:25:00Z
**Recipe:** durable
**Language:** Python
**Status:** ❌ FAIL - Host not starting

## Deployment

| Property | Value |
|----------|-------|
| Function App | `func-api-x7xtff7z2udxe` |
| Resource Group | `rg-durable-func-dev` |
| Region | eastus2 |
| Base Template | `functions-quickstart-python-http-azd` |

## Test Results

### Health Endpoint
```bash
curl "https://func-api-x7xtff7z2udxe.azurewebsites.net/api/health?code=<key>"
```

**Response:**
```
Function host is not running.
HTTP Status: 503
```

### Functions Listed (via CLI)
- `health_check` - httpTrigger
- `hello_orchestrator` - orchestrationTrigger  
- `http_start` - httpTrigger
- `say_hello` - activityTrigger

## Issue Analysis

The functions are registered but the host fails to start. Possible causes:
1. `azure-functions-durable` package compatibility with Flex Consumption
2. Python durable functions decorator syntax issue
3. Cold start timeout

## Requirements.txt
```
azure-functions
azure-functions-durable>=1.2.0
```

## Verdict

❌ **FAIL** - Durable recipe needs debugging:
- Functions listed correctly via CLI
- Host returns 503 "Function host is not running"
- May need to test on Consumption plan instead of Flex Consumption
- May need different durable functions syntax

## Next Steps
- [ ] Test on standard Consumption plan
- [ ] Verify durable-functions package version compatibility
- [ ] Check Azure Functions runtime logs
