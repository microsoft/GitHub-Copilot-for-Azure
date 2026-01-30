# AZD Errors

| Error | Resolution |
|-------|------------|
| Not authenticated | `azd auth login` |
| No environment | `azd env select <name>` |
| Provision failed | Check Bicep errors in output |
| Deploy failed | Check build/Docker errors |
| Package failed | Verify Dockerfile and dependencies |
| Quota exceeded | Request increase or change region |

## Retry

```bash
azd up --no-prompt
```

## Cleanup (DESTRUCTIVE)

```bash
azd down --force --purge
```

⚠️ Permanently deletes ALL resources including databases and Key Vaults.
