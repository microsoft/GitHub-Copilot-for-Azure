# Eval Summary

## Coverage Status

| Language | Manifest Templates | Eval | Status |
|----------|-------------------|------|--------|
| Python | 3 (Bicep) | ✅ | ✅ Verified |
| TypeScript | 1 (Bicep) | — | 📋 AZD template exists |
| JavaScript | 1 (Bicep) | — | 📋 AZD template exists |
| C# (.NET) | 8 (Bicep) | — | 📋 AZD template exists |
| Java | 1 (Bicep) | — | 📋 AZD template exists |
| PowerShell | — | — | ⚠️ No AZD template |

> ⚠️ **Eval cost note:** Each language eval requires ~5 min of agent runtime. Python is verified end-to-end; other languages confirmed in [manifest](https://cdn.functions.azure.com/public/templates-manifest/manifest.json). PowerShell has no Durable Functions AZD template. Multi-language eval expansion tracked as follow-up.

## MCP Tool Validation

| Test | Status | Details |
|------|--------|---------|
| Template fetch (driver) | ✅ PASS | driver fetch (list + get) |
| Template Discovery | ✅ PASS | Templates found via resource filter |
| IaC Included | ✅ PASS | Durable Task Scheduler Bicep in projectFiles |
| E2E Agent Test | ✅ PASS | 2 `azure-functions` calls, template retrieved and applied |

## Results

| Test | Python |
|------|--------|
| Health | ✅ |
| Orchestration starts | ✅ |
| Activities complete | ✅ |
| Status query works | ✅ |

## Notes

- Templates retrieved by the driver
- Uses Durable Task Scheduler (NOT Storage queues/tables)
- See [Durable Task Scheduler docs](../../../../../durable-task-scheduler/README.md)

## Test Date

2026-04-22
