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
| `functions_template_get` | ✅ PASS | Service Bus templates retrieved |
| Template Discovery | ✅ PASS | Templates found via resource filter |
| IaC Included | ✅ PASS | Service Bus Bicep + RBAC in projectFiles |
| E2E Agent Test | ⚠️ TIMEOUT | Agent execution exceeded 10 min limit |

## Results

| Test | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
|------|--------|------------|------------|------|------|------------|
| Health | ✅ | - | - | - | - | - |
| Queue message | ✅ | - | - | - | - | - |
| Output binding | ✅ | - | - | - | - | - |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- See README for UAMI troubleshooting (500 error, Unauthorized)

## Test Date

2025-04-16
