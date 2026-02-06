---
name: diagnose-429-errors
description: |
  **TROUBLESHOOTING SKILL** - Diagnose and resolve HTTP 429 rate limiting errors in Microsoft Foundry (Azure AI Foundry / Azure OpenAI).
  USE FOR: 429 error, rate limit exceeded, RateLimitReached, Too Many Requests, throttled, quota exceeded, token rate limit, TPM limit, RPM limit, retry after, capacity planning, "exceeded the token rate limit", deployment scaling, burst limits, multi-region scaling.
  DO NOT USE FOR: model deployment from scratch (use microsoft-foundry), authentication errors (use microsoft-foundry rbac), model availability checks (use check-model-availability).
  INVOKES: `az cognitiveservices` CLI, `az rest` API, `az monitor` CLI.
  FOR SINGLE OPERATIONS: Use `az cognitiveservices usage list` directly for simple quota checks.
---

# Diagnose Rate Limiting (429 Errors) in Microsoft Foundry

Guide for diagnosing and resolving HTTP 429 (Rate Limit Exceeded) errors in Microsoft Foundry through systematic quota analysis, usage pattern identification, and scaling strategies.

## Quick Reference

| Property | Value |
|----------|-------|
| **Error Type** | HTTP 429 - Too Many Requests |
| **Common Causes** | Low deployment allocation, quota exceeded, burst limits, SKU mismatch |
| **Key CLI Commands** | `az cognitiveservices usage list --location`, `deployment show` → check `rateLimits` |
| **Critical Check** | Verify `properties.rateLimits` for actual TPM/RPM (not just `sku.capacity`) |
| **Update Method** | Use `az rest --method PUT` (no CLI `update` command exists) |
| **Best For** | Debugging rate limits, capacity planning, quota vs allocation issues |

## When to Use

- **HTTP 429 errors** — "Rate limit exceeded" or "Too Many Requests"
- **Quota planning** — Capacity planning for production workloads
- **Throttled responses** — Slow API responses or deployment failures due to capacity
- **Retry optimization** — Implementing or improving retry strategies
- Questions like "Why am I getting rate limited?" or "How do I handle 429 errors?"

## Understanding Rate Limiting

| Limit Type | Scope | Description |
|------------|-------|-------------|
| **TPM (Tokens Per Minute)** | Deployment | Total tokens processed per minute |
| **RPM (Requests Per Minute)** | Deployment | Total requests per minute |
| **Concurrent Requests** | Deployment | Maximum simultaneous requests |
| **Burst Limits** | Deployment | Short-term spike allowance |
| **Regional Capacity** | Region | Shared capacity across subscriptions |

### Regional Quota vs Deployment Allocation

> ⚠️ **Warning:** You can have high regional quota but low deployment allocation — this is the most common cause of 429 errors!

| Concept | Scope | Where to Check |
|---------|-------|----------------|
| **Regional Quota** | Region + SKU | `az cognitiveservices usage list --location <region>` |
| **Deployment Allocation** | Individual deployment | `deployment show` → `rateLimits` |

**Common Mistake:** Seeing "50K TPM quota available" and thinking your deployment has 50K TPM. Your deployment might only have 1K TPM allocated from that 50K pool. **Solution:** Scale your deployment to use more of the available quota.

For SKU type details (GlobalStandard, DataZoneStandard, etc.), see [references/sku-types.md](references/sku-types.md).

## Diagnostic Workflow

### Step 1: Check Deployment Rate Limits

```bash
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, model:properties.model.name, sku:sku.name, capacity:sku.capacity, rateLimits:properties.rateLimits}" \
  --output json
```

**What to look for:** `rateLimits` shows actual TPM/RPM. `sku.capacity` may show `null` for pay-as-you-go — this is normal, check `rateLimits` instead. **1 unit = 1K TPM** is typical.

### Step 2: Check Regional Quota

```bash
az cognitiveservices usage list \
  --location <region> \
  --query "[?contains(name.value, '<model-name>')].{Name:name.value, Current:currentValue, Limit:limit}" \
  --output table
```

**Compare:** If regional quota has capacity but deployment allocation is low, scale the deployment (Step 4).

### Step 3: Analyze Error Patterns

```bash
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "AzureDiagnostics | where ResultType == '429' | where TimeGenerated > ago(24h)" \
  --output table
```

- **Consistent 429s** → sustained over-quota, need quota increase or scaling
- **Burst 429s** → temporary spikes, implement queuing or retry logic
- **Time-of-day patterns** → scale capacity during peak hours

For cross-deployment TPM analysis, see [references/tpm-analysis-script.md](references/tpm-analysis-script.md).

### Step 4: Implement Retry Logic

- Always check `Retry-After` header first
- Use exponential backoff (1s → 2s → 4s → 8s → 16s) with jitter
- Set max retries (3-5 recommended)

For code examples (Python, C#, JavaScript), see [references/RETRY_EXAMPLES.md](references/RETRY_EXAMPLES.md).

### Step 5: Scale Capacity

For scaling strategies (REST API, quota increase, multi-region), see [references/scaling-strategies.md](references/scaling-strategies.md).

## Common Issues & Quick Fixes

| Issue | Cause | Resolution |
|-------|-------|------------|
| Constant 429 errors | Sustained over-quota | Request quota increase or scale to multiple regions |
| Intermittent 429s | Burst traffic | Implement request queuing or retry with backoff |
| **429 with low usage** | **Low deployment TPM allocation** | Check `rateLimits` (not just regional quota). Scale deployment via REST API |
| **429 but quota available** | **Regional quota ≠ deployment allocation** | Scale deployment to use more of available quota pool |
| **`sku.capacity` null** | **Pay-as-you-go SKU** | Normal for GlobalStandard/DataZoneStandard. Check `rateLimits` instead |
| **InsufficientQuota on scale** | **Regional quota exhausted** | Free capacity from other deployments or request increase |
| **Wrong SKU error** | **SKU type mismatch** | Check deployment's actual SKU and use correct one in update |
| High Retry-After (>30s) | Severe rate violation | Check for request loops/bugs, reduce rate |

## Diagnostic Checklist

- [ ] Check `rateLimits` in deployment (not just `sku.capacity`)
- [ ] Identify SKU type and check correct quota pool
- [ ] Compare regional quota vs deployment allocation
- [ ] Review error frequency and Retry-After values
- [ ] Verify retry logic uses exponential backoff with jitter
- [ ] Analyze all deployments for shared quota contention
- [ ] Consider multi-region scaling if at regional limits

For best practices (capacity planning, monitoring, optimization), see [references/best-practices.md](references/best-practices.md).
