---
name: azure-diagnostics
description: Debug and troubleshoot production issues on Azure. Covers Container Apps diagnostics, App Service troubleshooting, log analysis with KQL, health checks, and common issue resolution for image pulls, cold starts, and health probes.
---

# Debugging Production Issues

## Quick Diagnosis Flow

1. **Identify symptoms** - What's failing?
2. **Check resource health** - Is Azure healthy?
3. **Review logs** - What do logs show?
4. **Analyze metrics** - Performance patterns?
5. **Investigate recent changes** - What changed?

## Container Apps Troubleshooting

### Common Issues Matrix

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Image pull failure | ACR credentials missing | `az containerapp registry set --identity system` |
| ACR build fails | ACR Tasks disabled (free sub) | Build locally with Docker |
| Cold start timeout | min-replicas=0 | `az containerapp update --min-replicas 1` |
| Port mismatch | Wrong target port | Check Dockerfile EXPOSE matches ingress |
| App keeps restarting | Health probe failing | Verify `/health` endpoint |

### Image Pull Failures

**Diagnose:**
```bash
# Check registry configuration
az containerapp show --name APP -g RG --query "properties.configuration.registries"

# Check revision status
az containerapp revision list --name APP -g RG --output table
```

**Fix:**
```bash
az containerapp registry set \
  --name APP -g RG \
  --server ACR.azurecr.io \
  --identity system
```

### ACR Tasks Disabled (Free Subscriptions)

**Symptom:** `az acr build` fails with "ACR Tasks is not supported"

**Fix: Build locally instead:**
```bash
docker build -t ACR.azurecr.io/myapp:v1 .
az acr login --name ACR
docker push ACR.azurecr.io/myapp:v1
```

### Cold Start Issues

**Symptom:** First request very slow or times out

**Fix:**
```bash
az containerapp update --name APP -g RG --min-replicas 1
```

### Health Probe Failures

**Symptom:** Container keeps restarting

**Check:**
```bash
# View health probe config
az containerapp show --name APP -g RG --query "properties.configuration.ingress"

# Check if /health endpoint responds
curl https://APP.REGION.azurecontainerapps.io/health
```

**Fix:** Ensure app has health endpoint returning 200:
```javascript
app.get('/health', (req, res) => res.sendStatus(200));
```

### Port Mismatch

**Symptom:** App starts but returns 502/503

**Check:**
```bash
az containerapp show --name APP -g RG --query "properties.configuration.ingress.targetPort"
```

**Verify:** App must listen on this exact port. Check:
- Dockerfile `EXPOSE` statement
- `process.env.PORT` or hardcoded port in app

### View Logs

```bash
# Stream logs (wait for replicas if scale-to-zero)
az containerapp logs show --name APP -g RG --follow

# Recent logs
az containerapp logs show --name APP -g RG --tail 100

# System logs (startup issues)
az containerapp logs show --name APP -g RG --type system
```

### Get All Diagnostic Info

```bash
# Combined diagnostic command
echo "=== Container App Diagnostics ===" && \
echo "Revisions:" && az containerapp revision list --name APP -g RG -o table && \
echo "Registry Config:" && az containerapp show --name APP -g RG --query "properties.configuration.registries" && \
echo "Ingress Config:" && az containerapp show --name APP -g RG --query "properties.configuration.ingress" && \
echo "Recent Logs:" && az containerapp logs show --name APP -g RG --tail 20
```

## Check Azure Resource Health

### Using MCP

```
Use azure_resourcehealth_* tools to check resource availability status.
```

### Using CLI

```bash
# Check specific resource health
az resource show --ids RESOURCE_ID

# Check recent activity
az monitor activity-log list -g RG --max-events 20
```

## Application Logs

### App Service

```bash
az webapp log tail --name APP -g RG
```

### Functions

```bash
func azure functionapp logstream FUNCTIONAPP
```

## Log Analytics (KQL)

Common diagnostic queries:

```kql
// Recent errors
AppExceptions
| where TimeGenerated > ago(1h)
| project TimeGenerated, Message, StackTrace
| order by TimeGenerated desc

// Failed requests
AppRequests
| where Success == false
| where TimeGenerated > ago(1h)
| summarize count() by Name, ResultCode
| order by count_ desc

// Slow requests
AppRequests
| where TimeGenerated > ago(1h)
| where DurationMs > 5000
| project TimeGenerated, Name, DurationMs
| order by DurationMs desc

// Dependency failures
AppDependencies
| where Success == false
| where TimeGenerated > ago(1h)
| summarize count() by Name, ResultCode, Target
```

## Common Issues by Service

### App Service

| Symptom | Check |
|---------|-------|
| 503 Service Unavailable | App logs, memory/CPU usage |
| Slow cold start | Always On setting, app startup |
| Deployment failures | Deployment logs, slot swap |

### Azure Functions

| Symptom | Check |
|---------|-------|
| Not triggering | Trigger configuration, host.json |
| Timeout errors | Execution time, plan limits |
| Cold starts | Premium plan, package size |

### Database Issues

| Symptom | Check |
|---------|-------|
| Connection failures | Firewall rules, connection limits |
| Slow queries | Query Performance Insights |
| Throttling | DTU/RU usage, tier limits |

## Using AppLens (MCP)

For comprehensive AI-powered diagnostics:

```
Use azure_applens tools to get:
- Automated issue detection
- Root cause analysis
- Remediation recommendations
```

## Escalation Checklist

Before escalating:
- [ ] Checked resource health status
- [ ] Reviewed application logs
- [ ] Analyzed recent deployments
- [ ] Checked for Azure service issues (status.azure.com)
- [ ] Reviewed metric dashboards
- [ ] Attempted basic remediation
