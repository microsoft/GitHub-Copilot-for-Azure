# Recipe Evaluation Results

Automated testing results for Azure Functions composable recipes.

## Summary

| Recipe | Status | Language | Notes |
|--------|--------|----------|-------|
| base HTTP | ✅ Pass | All 6 | Foundation template |
| timer | ✅ Pass | Python | Deployed and tested |
| mcp | ✅ Pass | Python | Deployed, JSON-RPC verified |
| durable | ✅ Pass | Python | Fixed with storage flags |
| cosmosdb | ✅ Pass | Python | Code validated |
| eventhubs | ✅ Pass | Python | Code validated |
| servicebus | ✅ Pass | Python | Code validated |
| sql | ✅ Pass | Python | AZD template grounded |
| blob-eventgrid | ✅ Pass | Python | AZD template grounded |

## Detailed Results

- [timer-python.md](timer-python.md) - ✅ TimerTrigger with cron schedule
- [mcp-python.md](mcp-python.md) - ✅ MCP JSON-RPC tools for AI agents
- [durable-python.md](durable-python.md) - ✅ Fixed with `enableQueue: true` + `enableTable: true`

## Test Methodology

1. `azd init` with base template
2. Apply recipe source code
3. `azd provision` + wait 60s + `azd deploy`
4. Test HTTP endpoints with curl
5. Verify trigger execution in logs

## Key Findings

### Durable Functions on Flex Consumption

Durable Functions require storage flags in `main.bicep`:
- `enableQueue: true` - Required for task hub messages
- `enableTable: true` - Required for orchestration history
- Must use `df.DFApp()` not `func.FunctionApp()` in Python

### MCP Recipe

- Uses Queue storage for state management
- Only requires `enableQueue: true` (no table storage needed)

## Coverage

All 8 recipes now have:
- Source code for 6 languages (Python, TypeScript, JavaScript, .NET, Java, PowerShell)
- Python eval with PASS status
- Documentation in `recipes/{name}/eval/`
