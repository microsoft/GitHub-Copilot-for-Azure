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
| `functions_template_get` | ✅ PASS | Event Hubs templates retrieved |
| Template Discovery | ✅ PASS | Templates found via resource filter |
| IaC Included | ✅ PASS | Event Hubs Bicep + RBAC in projectFiles |

## Results

| Test | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
|------|--------|------------|------------|------|------|------------|
| Health | ✅ | - | - | - | - | - |
| Event received | ✅ | - | - | - | - | - |
| Batch processing | ✅ | - | - | - | - | - |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- UAMI configuration included in template IaC

## Test Date

2025-04-16
