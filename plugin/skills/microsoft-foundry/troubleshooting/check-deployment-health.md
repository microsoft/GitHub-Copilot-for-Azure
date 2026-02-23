---
name: check-deployment-health
description: |
  **TROUBLESHOOTING SKILL** - Diagnose model deployment health issues in Microsoft Foundry (Azure AI Foundry / Azure OpenAI).
  USE FOR: deployment health, deployment status, deployment failed, provisioning error, deployment stuck, deployment not working, model not responding, inference failing, deployment degraded, deployment monitoring, health check, endpoint not working, deployment timeout, creating state, provisioning stuck, deployment errors, check deployment, model endpoint down, inference errors.
  DO NOT USE FOR: model availability checks (use check-model-availability), rate limiting/429 errors (use diagnose-429-errors), quota requests (use diagnose-429-errors), RBAC permissions (use microsoft-foundry rbac), deploying new models (use microsoft-foundry).
  INVOKES: `azure__foundry` (deployment status), `azure__monitor` (metrics/logs), `mcp__plugin_azure_azure__quota` MCP tools for diagnostics.
  FOR CLI USERS: Azure CLI fallback documented for each step.
---

# Check Deployment Health in Microsoft Foundry

Guide for diagnosing deployment health issues, monitoring deployed models, and troubleshooting deployment failures in Microsoft Foundry.

## Quick Reference

| Property | Value |
|----------|-------|
| **Key CLI Commands** | `az cognitiveservices account deployment show`, `az monitor metrics list` |
| **MCP Tools** | `foundry_resource_get`, `monitor_metrics_query`, `monitor_logs_query` |
| **Health Indicators** | Provisioning state, endpoint latency, error rate, availability |
| **Common Issue** | Deployment stuck in "Creating" or "Failed" state |
| **Best For** | Post-deployment health monitoring, troubleshooting inference failures |

## When to Use

- **Deployment stuck** — Creating, Updating, or other non-terminal state
- **Deployment failed** — Provisioning completed with errors
- **Inference not working** — Deployed model not responding to requests
- **Degraded performance** — Increased latency or error rates
- **Health monitoring** — Proactive health checks for production deployments

**Workflow:** Diagnose → Present solution options via AskUserQuestion → Execute remediation

## Understanding Deployment Health

### Provisioning States

| State | Meaning | Action Required |
|-------|---------|-----------------|
| **Succeeded** | Deployment ready | None — healthy |
| **Creating** | Deployment in progress | Wait (5-15 min typical) |
| **Updating** | Configuration change in progress | Wait |
| **Failed** | Deployment failed | Check error details |
| **Deleting** | Being removed | Wait |
| **Canceled** | User canceled | Retry or delete |

For detailed state transitions and failure modes, see [references/deployment-states.md](references/deployment-states.md).

### Health Indicators

| Indicator | Healthy | Degraded | Critical |
|-----------|---------|----------|----------|
| **Provisioning State** | Succeeded | Creating >15 min | Failed |
| **Endpoint Latency** | <500ms p95 | 500ms-2s | >2s or timeout |
| **Error Rate** | <1% | 1-5% | >5% |
| **Availability** | >99.9% | 99-99.9% | <99% |

For metric thresholds and monitoring setup, see [references/health-indicators.md](references/health-indicators.md).

## Diagnostic Workflow

### Step 1: Check Deployment Provisioning State

**Using MCP Tools (Preferred):**

Use `azure__foundry` MCP tool with command `foundry_resource_get`:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `resource-group` | Yes | Resource group containing the Foundry resource |
| `resource-name` | Yes | Name of the Azure OpenAI / Foundry resource (acts as `azure-ai-services`) |
| `subscription` | Yes | Subscription ID or name (omit only if `AZURE_SUBSCRIPTION_ID` env var is set) |

- Returns: Deployment status with provisioning details

**If Azure MCP is not enabled:** Run `/mcp add azure` or enable via `/mcp`.

**CLI Fallback:**
```bash
# Check deployment status
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, state:properties.provisioningState, model:properties.model.name, sku:sku.name}" \
  --output json
```

**Interpret Results:**
- `Succeeded` → Deployment is ready, check endpoint health (Step 2)
- `Creating` > 15 minutes → May be stuck, check Azure status
- `Failed` → Check error details in Step 5

### Step 2: Verify Endpoint Health

Test the deployment endpoint directly to verify it responds.

**Using MCP Tools:**

Use `azure__foundry` MCP tool with `foundry_openai_chat_completions_create`:
- Parameters: `deployment-name`, `messages` (simple test prompt)
- Returns: Response or error details

**CLI Fallback:**
```bash
# Get endpoint and key
ENDPOINT=$(az cognitiveservices account show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query "properties.endpoint" -o tsv)

KEY=$(az cognitiveservices account keys list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query "key1" -o tsv)

# Test endpoint with simple request
curl -X POST "${ENDPOINT}openai/deployments/<deployment-name>/chat/completions?api-version=2024-02-15-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: ${KEY}" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"max_tokens":5}'
```

### Step 3: Check Azure Monitor Metrics

**Using MCP Tools (Preferred):**

Use `azure__monitor` MCP tool with command `monitor_metrics_query`:
- Parameters:
  - `resource-id`: Full ARM resource ID of the Cognitive Services account
  - `metricnames`: "Latency,SuccessfulCalls,BlockedCalls,ServerErrors"
  - `timespan`: "PT1H" (past hour)
- Returns: Metric values showing health trends

**CLI Fallback:**
```bash
# Get deployment metrics
az monitor metrics list \
  --resource <resource-id> \
  --metric "Latency" "SuccessfulCalls" "BlockedCalls" "ServerErrors" \
  --interval PT5M \
  --output table
```

**What to look for:**
- High `ServerErrors` → Backend issues
- High `BlockedCalls` → Rate limiting or quota issues → use diagnose-429-errors skill
- Increasing `Latency` → Degradation
- Zero `SuccessfulCalls` → Endpoint not responding

### Step 4: Query Deployment Logs

**Using MCP Tools (Preferred):**

Use `azure__monitor` MCP tool with command `monitor_logs_query`:
- Parameters:
  - `workspace`: Log Analytics workspace ID
  - `analytics-query`: See query below
  - `timespan`: "P1D" (past day)

**Log Analytics Query:**
```kusto
AzureDiagnostics
| where ResourceType == "COGNITIVESERVICES"
| where OperationName contains "Deploy"
| where TimeGenerated > ago(24h)
| project TimeGenerated, OperationName, ResultType, ResultDescription
| order by TimeGenerated desc
```

**CLI Fallback:**
```bash
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "AzureDiagnostics | where ResourceType == 'COGNITIVESERVICES' | where TimeGenerated > ago(24h) | project TimeGenerated, OperationName, ResultType" \
  --output table
```

### Step 5: Analyze Deployment Errors

If deployment is in `Failed` state, get detailed error information.

**CLI Commands:**
```bash
# Get full deployment details including error
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --output json

# Check ARM deployment operations for detailed errors
az deployment operation group list \
  --resource-group <resource-group> \
  --name <deployment-operation-name> \
  --query "[?properties.provisioningState=='Failed'].{Operation:operationId, Error:properties.statusMessage}" \
  --output json
```

### Step 6: Present Remediation Options

**IMPORTANT:** Use `AskUserQuestion` to present solution options based on diagnosis.

For solution presentation patterns, see [references/solution-selection.md](references/solution-selection.md).

## Common Issues & Quick Fixes

| Issue | Cause | Resolution |
|-------|-------|------------|
| **Stuck in "Creating"** | Resource provisioning delays | Wait 15-30 min, check Azure status |
| **Failed with "InsufficientQuota"** | No available capacity | Request quota increase or try different region |
| **Failed with "ModelNotFound"** | Model unavailable in region | Use check-model-availability skill |
| **Endpoint timeout** | Network/backend issues | Check Azure status, test from Azure portal |
| **5xx errors** | Service-side issues | Check Azure status, retry later |
| **Increased latency** | Capacity constraints | Scale deployment or add regions |
| **Intermittent failures** | Transient issues | Implement retry logic with backoff |

## Diagnostic Checklist

- [ ] Check deployment provisioning state (`Succeeded`, `Failed`, etc.)
- [ ] If stuck in `Creating` >15 min, check Azure service status
- [ ] If `Failed`, retrieve detailed error message
- [ ] Test endpoint directly with simple request
- [ ] Check Azure Monitor metrics for error rates and latency
- [ ] Query deployment logs for error patterns
- [ ] Verify region has model capacity (if provisioning failed)
- [ ] **Present solution options to user via AskUserQuestion**

## When to Escalate

Escalate to Azure Support when:
- Deployment stuck in `Creating` state > 1 hour
- Repeated `Failed` deployments with unclear errors
- Endpoint returns 5xx errors with no Azure status issues
- Metrics show degradation but no clear cause

## Additional Resources

- **Azure Status:** https://status.azure.com
- **ARM Deployment Operations:** https://aka.ms/arm-deployment-operations
- **Azure AI Foundry Docs:** https://learn.microsoft.com/azure/ai-foundry/
- **Detailed State Transitions:** [references/deployment-states.md](references/deployment-states.md)
- **Health Monitoring Guide:** [references/health-indicators.md](references/health-indicators.md)
