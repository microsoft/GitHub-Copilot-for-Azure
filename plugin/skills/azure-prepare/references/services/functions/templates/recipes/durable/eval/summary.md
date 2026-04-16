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
| `functions_template_get` | ✅ PASS | Durable templates retrieved |
| Template Discovery | ✅ PASS | Templates found via resource filter |
| IaC Included | ✅ PASS | Durable Task Scheduler Bicep in projectFiles |

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
- See [Durable Task Scheduler docs](../../../../durable-task-scheduler/README.md)

## Test Date

2025-04-16
