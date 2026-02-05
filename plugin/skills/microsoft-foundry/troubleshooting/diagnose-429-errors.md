# Diagnose Rate Limiting (429 Errors) in Microsoft Foundry

Guide for diagnosing and resolving HTTP 429 (Rate Limit Exceeded) errors in Microsoft Foundry through systematic quota analysis, usage pattern identification, and scaling strategies.

## Quick Reference

| Property | Value |
|----------|-------|
| **Error Type** | HTTP 429 - Too Many Requests |
| **Common Causes** | Quota exceeded, burst limits, concurrent requests |
| **CLI Commands** | `az cognitiveservices usage`, `az cognitiveservices account deployment show` |
| **Best For** | Debugging rate limits, capacity planning, retry optimization |

## When to Use

Use this reference when encountering:

- **HTTP 429 errors** - "Rate limit exceeded" or "Too Many Requests"
- **Quota planning** - Capacity planning for production workloads
- **Throttled responses** - Slow API responses or deployment failures due to capacity
- **Retry optimization** - Implementing or improving retry strategies
- Questions like "Why am I getting rate limited?" or "How do I handle 429 errors?"

## Understanding Rate Limiting

Microsoft Foundry enforces multiple rate limit types:

| Limit Type | Scope | Description |
|------------|-------|-------------|
| **TPM (Tokens Per Minute)** | Deployment | Total tokens processed per minute |
| **RPM (Requests Per Minute)** | Deployment | Total requests per minute |
| **Concurrent Requests** | Deployment | Maximum simultaneous requests |
| **Burst Limits** | Deployment | Short-term spike allowance |
| **Regional Capacity** | Region | Shared capacity across subscriptions |

**Typical Error Messages:**
```
Rate limit is exceeded. Try again in X seconds.
HTTP 429: Too Many Requests
RetryAfter: 60
```

## Diagnostic Workflow

Follow this systematic approach to diagnose and resolve rate limiting:

### 1. Check Current Quota Usage

Determine if you're hitting quota limits.

**Bash:**
```bash
# Check all quota usage
az cognitiveservices usage list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query "[].{Name:name.value, Current:currentValue, Limit:limit}" \
  --output table

# Check specific deployment capacity
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, capacity:properties.sku.capacity, model:properties.model.name}"
```

**What to Look For:**
- `currentValue` approaching `limit` → quota exhaustion
- `limit` of 0 or null → no quota assigned
- Multiple deployments → may be competing for shared quota

### 2. Analyze 429 Error Patterns

Review recent errors to identify patterns.

**Azure Monitor KQL Query:**
```kql
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
| where ResultType == "429"
| where TimeGenerated > ago(24h)
| project TimeGenerated, OperationName, DurationMs
| order by TimeGenerated desc
```

**Or via CLI:**
```bash
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "AzureDiagnostics | where ResultType == '429' | where TimeGenerated > ago(24h)" \
  --output table
```

**Pattern Identification:**
- **Consistent 429s** → sustained over-quota usage, need quota increase
- **Burst 429s** → temporary spikes, implement queuing or burst quota
- **Time-of-day patterns** → identify peak usage for scaling
- **Specific operations** → some endpoints may have tighter limits

### 3. Verify Deployment Capacity

Ensure sufficient capacity is allocated.

**Bash:**
```bash
# List all deployments with capacity
az cognitiveservices account deployment list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query "[].{Name:name, Model:properties.model.name, Capacity:properties.sku.capacity, Status:properties.provisioningState}" \
  --output table
```

**Capacity Guidelines:**
- Capacity units vary by model (e.g., 1K TPM per unit for GPT-4)
- Minimum: 1 unit
- Maximum: Region and quota dependent

### 4. Implement Retry Logic

Proper retry handling reduces error impact and respects rate limits.

**Core Pattern:**
- Always check `Retry-After` header first
- Use exponential backoff (1s → 2s → 4s → 8s → 16s)
- Add jitter to prevent thundering herd
- Set max retries (3-5 recommended)
- Log retry attempts for monitoring

**For detailed code examples**, see [RETRY_EXAMPLES.md](RETRY_EXAMPLES.md) for Python, C#, and JavaScript implementations.

### 5. Scale Capacity

Choose appropriate scaling strategy based on diagnosis.

#### Option A: Request Quota Increase

For sustained high usage:

1. **Check current limits:**
   ```bash
   az cognitiveservices usage list \
     --name <foundry-resource-name> \
     --resource-group <resource-group> \
     --query "[?name.value=='TokensPerMinute'].{Current:currentValue, Limit:limit}"
   ```

2. **Submit request** via Azure Portal → Resource → Quotas → Request increase

**Quota Recommendations:**

| Scenario | Recommended TPM |
|----------|----------------|
| Development/Testing | 10K TPM |
| Production (Low Traffic) | 50K-100K TPM |
| Production (Medium Traffic) | 100K-500K TPM |
| Production (High Traffic) | 500K+ TPM, consider multi-region |

#### Option B: Multi-Region Deployment

For burst workloads or geographic distribution:

**Deploy to multiple regions:**
```bash
# Deploy to primary region
az cognitiveservices account deployment create \
  --name foundry-eastus --resource-group rg-eastus \
  --deployment-name gpt-4o-eastus \
  --model-name gpt-4o --model-version "2024-05-13" \
  --sku-capacity 30

# Deploy to secondary region
az cognitiveservices account deployment create \
  --name foundry-westeurope --resource-group rg-westeurope \
  --deployment-name gpt-4o-westeurope \
  --model-name gpt-4o --model-version "2024-05-13" \
  --sku-capacity 30
```

**Benefits:**
- Increased total capacity (quota per region)
- Geographic redundancy and failover
- Reduced latency for global users

**For load balancing patterns**, see [RETRY_EXAMPLES.md](RETRY_EXAMPLES.md#multi-region-load-balancing).

## Diagnostic Checklist

Use this checklist when troubleshooting 429 errors:

- [ ] **Check quota usage** - At or near limits?
- [ ] **Review error logs** - When and how often?
- [ ] **Verify deployment capacity** - Allocated correctly?
- [ ] **Check retry logic** - Exponential backoff implemented?
- [ ] **Identify usage patterns** - Peak times or constant load?
- [ ] **Review request sizes** - Token counts optimal?
- [ ] **Check concurrent requests** - Exceeding limits?
- [ ] **Consider multi-region** - Would distributed load help?

## Common Issues & Quick Fixes

| Issue | Cause | Resolution |
|-------|-------|------------|
| Constant 429 errors | Sustained over-quota | Request quota increase or scale to multiple regions |
| Intermittent 429s | Burst traffic | Implement request queuing or burst quota |
| 429 during peak hours only | Time-based spike | Scale up capacity during peak times |
| 429 with low usage | Deployment not scaled | Increase deployment capacity units |
| High Retry-After values | Severe rate violation | Check for request loops/bugs, reduce rate |
| 429 on specific operations | Operation-specific limits | Check operation quotas separately |
| No 429 but slow responses | Approaching limits | Proactively increase quota before hitting limit |

## Best Practices

### Capacity Planning

1. **Monitor baseline** - Track TPM/RPM over time
2. **Plan for growth** - Request 20-30% more quota than current need
3. **Test at scale** - Load test before production launch
4. **Set up alerts** - Alert at 70-80% quota usage

**Sample alert:**
```bash
az monitor metrics alert create \
  --name "High-Rate-Limit-Errors" \
  --resource <foundry-resource-id> \
  --condition "count HttpErrors where ResultType == 429 > 10" \
  --window-size 5m --evaluation-frequency 1m
```

### Request Optimization

**Token Usage:**
- Monitor token consumption per request
- Truncate input to stay within limits (1 token ≈ 4 characters)
- Use shorter system prompts when possible

**Batch Processing:**
- Process requests in batches (e.g., 10 at a time)
- Add brief pauses between batches (1-2 seconds)
- Spread load over time rather than bursts

### Monitoring Strategy

**Key Metrics to Track:**
- Total requests per minute (RPM)
- Total tokens per minute (TPM)
- 429 error rate and frequency
- Retry success rate
- P95/P99 latency

**Set up dashboards** in Azure Monitor to visualize these metrics and identify trends before they become issues.

## Additional Resources

- [Azure Cognitive Services Quotas and Limits](https://learn.microsoft.com/azure/cognitive-services/openai/quotas-limits)
- [Dynamic Quota Management](https://learn.microsoft.com/azure/cognitive-services/openai/how-to/dynamic-quota)
- [Monitoring OpenAI Models](https://learn.microsoft.com/azure/cognitive-services/openai/how-to/monitoring)
- [Rate Limiting Best Practices](https://learn.microsoft.com/azure/architecture/best-practices/retry-service-specific#azure-openai)
- **Code Examples**: See [RETRY_EXAMPLES.md](RETRY_EXAMPLES.md) for implementation patterns
