# Handle Errors

Troubleshoot deployment failures.

## Common Errors

| Error | Resolution |
|-------|------------|
| `Not authenticated` | Run `azd auth login` |
| `No environment selected` | Run `azd env select <name>` |
| `Provision failed` | Check Bicep errors, permissions, quotas |
| `Deploy failed` | Check build errors, Docker issues |
| `Package failed` | Verify Dockerfile and dependencies |
| `Quota exceeded` | Request quota increase or change region |

## Debugging Steps

1. Check the error message for the specific resource
2. View detailed logs: `azd show --output json`
3. Check Azure Portal for resource-level errors
4. Fix the issue and re-run deployment

## Retry Deployment

After fixing issues:

```bash
# Retry full deployment
azd up --no-prompt

# Or retry just the failed step
azd provision --no-prompt  # if infra failed
azd deploy --no-prompt     # if deploy failed
```
