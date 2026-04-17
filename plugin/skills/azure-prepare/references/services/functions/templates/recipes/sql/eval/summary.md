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
| IaC Included | ✅ PASS | SQL Server Bicep + RBAC in projectFiles |
| E2E Agent Test | ✅ PASS | 3 azure-functions calls, 3m 43s, template retrieved and applied |

## IaC Validation

| IaC Type | File | Syntax | Policy Compliant | Status |
|----------|------|--------|------------------|--------|
| Bicep | sql.bicep | ✅ | ✅ | PASS |
| Terraform | sql.tf | ✅ | ✅ | PASS |

## Deployment Validation

| Test | Status | Details |
|------|--------|---------|
| AZD Template Init | ✅ PASS | `functions-quickstart-python-azd-sql` |
| AZD Provision | ✅ PASS | Resources created in `rg-sql-eval` |
| AZD Deploy | ✅ PASS | Function deployed to `func-api-arkwcvhvbkqwc` |
| HTTP Response | ✅ PASS | HTTP 200 from function endpoint |
| SQL Server | ✅ PASS | `sql-arkwcvhvbkqwc` with Entra-only auth |
| SQL Database | ✅ PASS | `ToDo` database created |

## Results

| Test | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
|------|--------|------------|------------|------|------|------------|
| Health | ✅ | - | - | - | - | - |
| SQL trigger | ✅ | - | - | - | - | - |
| SQL output | ✅ | - | - | - | - | - |

## Notes

- Templates retrieved via `functions_template_get(language, template)` MCP tool
- Dedicated AZD templates available for Python, TypeScript, .NET
- Requires T-SQL post-deploy for managed identity access

## IaC Features

| Feature | Bicep | Terraform |
|---------|-------|-----------|
| SQL Server (Entra-only) | ✅ | ✅ |
| SQL Database | ✅ | ✅ |
| Firewall Rules | ✅ | ✅ |
| Private Endpoint (VNet) | ✅ | ✅ |
| Azure Policy Compliance | ✅ | ✅ |

## Post-Deploy Note

SQL managed identity access requires T-SQL after deployment:
```sql
CREATE USER [<function-app-name>] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [<function-app-name>];
ALTER ROLE db_datawriter ADD MEMBER [<function-app-name>];
```

## Test Date

2026-04-17
