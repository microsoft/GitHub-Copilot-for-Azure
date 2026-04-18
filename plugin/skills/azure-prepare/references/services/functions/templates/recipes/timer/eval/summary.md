# Eval Summary

## Coverage Status

| Language | Manifest Templates | Eval | Status |
|----------|-------------------|------|--------|
| Python | 1 (Bicep) | ✅ | ✅ Verified |
| TypeScript | 1 (Bicep) | — | 📋 AZD template exists |
| JavaScript | 1 (Bicep) | — | 📋 AZD template exists |
| C# (.NET) | 1 (Bicep) | — | 📋 AZD template exists |
| Java | 1 (Bicep) | — | 📋 AZD template exists |
| PowerShell | 1 (Bicep) | — | 📋 AZD template exists |

> ⚠️ **Eval cost note:** Each language eval requires ~5 min of agent runtime. Python is verified end-to-end; other languages confirmed in [manifest](https://cdn.functions.azure.com/public/templates-manifest/manifest.json). Multi-language eval expansion tracked as follow-up.

## MCP Tool Validation

| Test | Status | Details |
|------|--------|---------|
| `functions_template_get` | ✅ PASS | 2 calls via `azure-functions` MCP tool |
| Template Discovery | ✅ PASS | Timer templates found via resource filter |
| IaC Included | ✅ PASS | Bicep infra/ included in projectFiles |
| E2E Agent Test | ✅ PASS | 3 azure-functions calls, 5m 21s, template retrieved and applied |

## Results

| Test | Python |
|------|--------|
| Health | ✅ |
| Timer fires | ✅ |
| Schedule correct | ✅ |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- Timer templates include cron schedule in function code

## Test Date

2026-04-17
