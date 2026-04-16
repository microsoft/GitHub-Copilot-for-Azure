# Base HTTP Template - Eval Summary

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
| `functions_template_get` | ✅ PASS | Returns template with functionFiles + projectFiles |
| Template Discovery | ✅ PASS | HTTP templates found for all languages |
| IaC Included | ✅ PASS | Bicep infra/ included in projectFiles |
| E2E Agent Test | ✅ PASS | 5 API calls, 54s, `http-trigger-python-azd` retrieved |

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

2025-04-16
