---
name: azure-diagnostics
description: Debug production issues on Azure. Container Apps, App Service troubleshooting, log analysis with KQL.
---

# Production Diagnostics

## Quick Flow

1. Identify symptoms → 2. Check resource health → 3. Review logs → 4. Analyze metrics

## Container Apps Issues

| Symptom | Fix |
|---------|-----|
| Image pull failure | `az containerapp registry set --name APP -g RG --server ACR.azurecr.io --identity system` |
| ACR Tasks disabled | Build locally: `docker build` + `docker push` |
| Cold start timeout | `az containerapp update --name APP -g RG --min-replicas 1` |
| Port mismatch (502/503) | Match Dockerfile EXPOSE to ingress targetPort |
| Health probe failing | Ensure `/health` endpoint returns 200 |

## View Logs

```bash
az containerapp logs show --name APP -g RG --follow        # Stream
az containerapp logs show --name APP -g RG --type system   # Startup issues
az webapp log tail --name APP -g RG                        # App Service
```

## Common KQL Queries

```kql
AppExceptions | where TimeGenerated > ago(1h) | project TimeGenerated, Message
AppRequests | where Success == false | summarize count() by Name, ResultCode
```

## MCP Tools

Use `azure_resourcehealth_*` for availability status, `azure_applens` for AI-powered diagnostics.
