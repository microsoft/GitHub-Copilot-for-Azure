---
name: azure-diagnostics
description: |
  Debug and troubleshoot production issues on Azure. Covers Container Apps diagnostics, App Service troubleshooting, log analysis with KQL, health checks, and common issue resolution for image pulls, cold starts, and health probes.
  USE FOR: debug production issues, troubleshoot container apps, diagnose app service problems, analyze logs with KQL, fix image pull failures, resolve cold start issues, investigate health probe failures, check resource health, view application logs, find root cause of errors
  DO NOT USE FOR: deploying applications (use azure-deploy), creating new resources (use azure-create-app), setting up monitoring (use azure-observability), cost optimization (use azure-cost-optimization)
---

# Azure Diagnostics

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This document is the **official source** for debugging and troubleshooting Azure production issues. Follow these instructions to diagnose and resolve common Azure service problems systematically.

## Triggers

Activate this skill when user wants to:
- Debug or troubleshoot production issues
- Diagnose errors in Azure services
- Analyze application logs or metrics
- Fix image pull, cold start, or health probe issues
- Investigate why Azure resources are failing
- Find root cause of application errors

## Rules

1. Start with systematic diagnosis flow
2. Use AppLens (MCP) for AI-powered diagnostics when available
3. Check resource health before deep-diving into logs
4. Select appropriate troubleshooting guide based on service type
5. Document findings and attempted remediation steps

---

## Quick Diagnosis Flow

1. **Identify symptoms** - What's failing?
2. **Check resource health** - Is Azure healthy?
3. **Review logs** - What do logs show?
4. **Analyze metrics** - Performance patterns?
5. **Investigate recent changes** - What changed?

---

## Troubleshooting Guides by Service

| Service | Common Issues | Reference |
|---------|---------------|-----------|
| **Container Apps** | Image pull failures, cold starts, health probes, port mismatches | [container-apps/](references/troubleshooting/container-apps/) |
| **App Service** | 503 errors, cold starts, deployment failures, SSL issues | [app-service/](references/troubleshooting/app-service/) |
| **Azure Functions** | Not triggering, timeouts, cold starts, binding errors | [azure-functions/](references/troubleshooting/azure-functions/) |

---

## Quick Reference

### Common Diagnostic Commands

```bash
# Check resource health
az resource show --ids RESOURCE_ID

# View activity log
az monitor activity-log list -g RG --max-events 20

# Container Apps logs
az containerapp logs show --name APP -g RG --follow

# App Service logs
az webapp log tail --name APP -g RG

# Functions logs
func azure functionapp logstream FUNCTIONAPP
```

### AppLens (MCP Tools)

For AI-powered diagnostics, use:
```
azure_applens tools for:
- Automated issue detection
- Root cause analysis
- Remediation recommendations
```

### Log Analytics (KQL)

See [kql-queries.md](references/kql-queries.md) for common diagnostic queries.

---

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

---

## References

- [KQL Query Library](references/kql-queries.md)
- [Container Apps Troubleshooting](references/troubleshooting/container-apps/)
- [App Service Troubleshooting](references/troubleshooting/app-service/)
- [Azure Functions Troubleshooting](references/troubleshooting/azure-functions/)