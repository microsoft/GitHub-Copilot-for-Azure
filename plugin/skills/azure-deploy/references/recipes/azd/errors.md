# AZD Errors

| Error | Resolution |
|-------|------------|
| Not authenticated | `azd auth login` |
| No environment | `azd env select <name>` |
| Provision failed | Check Bicep errors in output |
| Deploy failed | Check build/Docker errors |
| Package failed | Verify Dockerfile and dependencies |
| Quota exceeded | Request increase or change region |
| Provisioning fails in specific region | Try alternative region (capacity issue, not service unavailability). Static content is globally distributed regardless of region. |
| Request is missing pull request id | For Static Web Apps: Ensure using `azd deploy`, not GitHub Actions PR workflow |

## Static Web Apps Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| npm install fails for static site | `language: js` triggers build detection | Remove `language` field from azure.yaml for pure static sites |
| Application Error after deployment | Incorrect outputLocation or missing index.html | Verify buildProperties.outputLocation matches build output; ensure index.html exists |
| Deployment token invalid | Token expired or wrong app | Regenerate token: `az staticwebapp secrets list --name <app-name>` |

See also: [Static Web Apps Deployment Guide](static-web-apps.md)

## Retry

```bash
azd up --no-prompt
```

## Cleanup (DESTRUCTIVE)

```bash
azd down --force --purge
```

⚠️ Permanently deletes ALL resources including databases and Key Vaults.
