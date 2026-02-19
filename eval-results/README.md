# Recipe Evaluation Results

Automated testing results for Azure Functions composable recipes.

## Summary

| Recipe | Status | Language | Function App | Tested |
|--------|--------|----------|--------------|--------|
| timer | ✅ Pass | Python | func-api-gxlcc37knhe2m | 2026-02-19 |
| mcp | ✅ Pass | Python | func-api-jrfqkfm6l63is | 2026-02-19 |
| durable | ❌ Fail | Python | func-api-x7xtff7z2udxe | 2026-02-19 |
| servicebus | ✅ Pass | Python, TS, JS, .NET, PS | Multiple | 2026-02-18 |
| eventhubs | ✅ Pass | Python | func-api-... | 2026-02-18 |

## Detailed Results

- [timer-python.md](timer-python.md) - ✅ TimerTrigger with cron schedule
- [mcp-python.md](mcp-python.md) - ✅ MCP JSON-RPC tools for AI agents
- [durable-python.md](durable-python.md) - ❌ Host not starting on Flex Consumption

## Test Methodology

1. `azd init` with base template
2. Apply recipe source code
3. `azd provision` + wait 60s + `azd deploy`
4. Test HTTP endpoints with curl
5. Verify trigger execution in logs

## Recipes Tested Today (2026-02-19)

- **timer**: ✅ Works - health returns configured schedule
- **mcp**: ✅ Works - tools/list and tools/call both work
- **durable**: ❌ Blocked - Function host returns 503

## Next Steps

- [ ] Debug durable functions on Flex Consumption
- [ ] Create sql recipe  
- [ ] Create blob-eventgrid recipe
