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
| `functions_template_get` | ✅ PASS | Cosmos templates retrieved |
| Template Discovery | ✅ PASS | Cosmos templates found via resource filter |
| IaC Included | ✅ PASS | Cosmos Bicep module + RBAC in projectFiles |
| E2E Agent Test | ✅ PASS | 5 API calls, 49s, template retrieved |

## Results

| Test | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
|------|--------|------------|------------|------|------|------------|
| Health | ✅ | - | - | - | - | - |
| Trigger fires | ✅ | - | - | - | - | - |
| Change detected | ✅ | - | - | - | - | - |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- Cosmos DB requires dual RBAC: Azure control plane + SQL data plane
- See README for RBAC troubleshooting

## Test Date

2025-04-16
