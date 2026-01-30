# Error Handling Guide

**Core principle:** Continue on failure. Capture all issues in the final report.

## Authentication Errors

| Error | Detection | Action |
|-------|-----------|--------|
| Not logged in (az) | `Please run 'az login'` | Note in report, skip az commands |
| Not logged in (azd) | `run 'azd auth login'` | Note in report, skip azd commands |
| Token expired | `AADSTS700024`, `AADSTS50173` | Suggest re-authentication |

## Permission Errors

| Error | Detection | Action |
|-------|-----------|--------|
| RBAC insufficient | `AuthorizationFailed` | Retry with `--validation-level ProviderNoRbac` |
| Resource group missing | `ResourceGroupNotFound` | Note in report, suggest `az group create` |
| Subscription access | `SubscriptionNotFound` | Check subscription ID |

## Bicep Errors

| Error | Detection | Action |
|-------|-----------|--------|
| Syntax error | `BCP064`, `BCP018` | Parse line/column, include all errors |
| Module not found | `BCP091`, `BCP190` | Check if `bicep restore` needed |
| Parameter issues | `BCP032`, `BCP035` | Note which parameters are problematic |

**Error format:** `<file>(<line>,<column>) : <severity> <code>: <message>`

## Tool Not Installed

| Tool | Detection | Action |
|------|-----------|--------|
| Azure CLI | `az: command not found` | Provide install instructions, skip az commands |
| Bicep CLI | `bicep: command not found` | Try `az bicep build`, provide install link |
| azd | `azd: command not found` | Fall back to az CLI if possible |

## What-If Errors

| Error | Handling |
|-------|----------|
| Nested template limits | Note as warning, explain "Ignore" resources |
| templateLink not supported | Note as warning, resources verified at deploy |
| Unevaluated expressions | Informational, evaluated at deployment time |

## Network Errors

| Error | Action |
|-------|--------|
| Timeout | Suggest retry, check connectivity |
| SSL/TLS errors | May indicate proxy/firewall, check SSL settings |

## Fallback Strategy

```
Provider (full RBAC) → ProviderNoRbac (read-only) → Template (syntax) → Report failures
```

## Exit Codes

| Tool | 0 | 1 | 2 |
|------|---|---|---|
| az | Success | Error | Command not found |
| azd | Success | Error | - |
| bicep | Success | Errors | Warnings |
