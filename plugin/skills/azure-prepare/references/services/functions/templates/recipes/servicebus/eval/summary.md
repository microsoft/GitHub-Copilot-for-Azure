# Eval Summary

## Coverage Status

| Language | Manifest Templates | Eval | Status |
|----------|-------------------|------|--------|
| Python | — | ✅ | ✅ Verified (no AZD template) |
| TypeScript | — | — | ⚠️ No AZD template |
| JavaScript | — | — | ⚠️ No AZD template |
| C# (.NET) | — | — | ⚠️ No AZD template |
| Java | — | — | ⚠️ No AZD template |
| PowerShell | — | — | ⚠️ No AZD template |

> ⚠️ **No Service Bus AZD templates exist in the [functions template manifest](https://cdn.functions.azure.com/public/templates-manifest/manifest.json).** The Service Bus recipe relies on agent-composed scaffolding rather than a dedicated AZD quickstart repo.

## MCP Tool Validation

| Test | Status | Details |
|------|--------|---------|
| `functions_template_get` | ✅ PASS | 2 calls via `azure-functions` MCP tool |
| Template Discovery | ✅ PASS | Templates found via resource filter |
| IaC Included | ✅ PASS | Service Bus Bicep + RBAC in projectFiles |
| E2E Agent Test | ✅ PASS | 2 azure-functions calls, 8m 33s, template retrieved and applied |

## Results

| Test | Python |
|------|--------|
| Health | ✅ |
| Queue message | ✅ |
| Output binding | ✅ |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- See README for UAMI troubleshooting (500 error, Unauthorized)

## Test Date

2026-04-17
