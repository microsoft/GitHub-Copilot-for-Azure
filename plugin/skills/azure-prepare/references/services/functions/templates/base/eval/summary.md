# Base HTTP Template - Eval Summary

## Coverage Status

| Language | MCP Template | Eval | Status |
|----------|--------------|------|--------|
| Python | ✅ | [✅](python.md) | PASS |
| TypeScript | ✅ | 🔲 | Pending |
| JavaScript | ✅ | 🔲 | Pending |
| C# (.NET) | ✅ | 🔲 | Pending |
| Java | ✅ | 🔲 | Pending |
| PowerShell | ✅ | 🔲 | Pending |

## MCP Tool Validation

| Test | Status | Details |
|------|--------|---------|
| `functions_template_get` | ✅ PASS | 2 calls via `azure-functions` MCP tool |
| Template Discovery | ✅ PASS | HTTP templates found for all languages |
| IaC Included | ✅ PASS | Bicep/Terraform infra/ included in projectFiles |
| E2E Agent Test | ✅ PASS | 4 azure-functions calls, 5m 42s, template retrieved and applied |

## Results

| Test | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
|------|--------|------------|------------|------|------|------------|
| Syntax Valid | ✅ | - | - | - | - | - |
| Health Endpoint | ✅ | - | - | - | - | - |
| HTTP Trigger | ✅ | - | - | - | - | - |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- Base HTTP template provides the foundation for all recipes
- All recipes compose on top of this base

## Test Date

2026-04-17
