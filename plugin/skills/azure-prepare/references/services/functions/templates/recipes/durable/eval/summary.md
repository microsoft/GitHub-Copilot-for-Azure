# Eval Summary

## Coverage Status

| Language | MCP Template | Eval | Status |
|----------|--------------|------|--------|
| Python | ✅ | ✅ | PASS |
| TypeScript | ✅ | 🔲 | Pending |
| JavaScript | ✅ | 🔲 | Pending |
| C# (.NET) | ✅ | 🔲 | Pending |
| Java | ✅ | 🔲 | Pending |
| PowerShell | ✅ | 🔲 | Pending |

## MCP Tool Validation

| Test | Status | Details |
|------|--------|---------|
| `functions_template_get` | ✅ PASS | 2 calls via `azure-functions` MCP tool |
| Template Discovery | ✅ PASS | Templates found via resource filter |
| IaC Included | ✅ PASS | Durable Task Scheduler Bicep in projectFiles |
| E2E Agent Test | ✅ PASS | 2 azure-functions calls, 4m 15s, template retrieved and applied |

## Results

| Test | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
|------|--------|------------|------------|------|------|------------|
| Health | ✅ | - | - | - | - | - |
| Orchestration starts | ✅ | - | - | - | - | - |
| Activities complete | ✅ | - | - | - | - | - |
| Status query works | ✅ | - | - | - | - | - |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- Uses Durable Task Scheduler (NOT Storage queues/tables)
- See [Durable Task Scheduler docs](../../../../../durable-task-scheduler/README.md)

## Test Date

2026-04-17
