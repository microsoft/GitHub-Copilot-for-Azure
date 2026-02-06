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

### Regional Quota vs Deployment Allocation

**Critical distinction** that causes confusion:

| Concept | Scope | Example | Where to Check |
|---------|-------|---------|----------------|
| **Regional Quota** | Region + SKU | 50 units (50K TPM) available for all gpt-5.1 DataZoneStandard deployments | `az cognitiveservices usage list --location <region>` |
| **Deployment Allocation** | Individual deployment | 2 units (2K TPM) allocated to your specific gpt-5.1 deployment | `deployment show` → `rateLimits` |

**Example Scenario:**
```
Regional Quota:     50 units (50K TPM) for gpt-5.1 DataZoneStandard
Used by Deployment: 2 units (2K TPM) allocated to "gpt-5.1" deployment
Available:          48 units (48K TPM) remaining for other deployments
```

**Key Points:**
- 🔢 **Regional quota** = Total TPM pool available in a region for a specific model + SKU combination
- 📦 **Deployment allocation** = TPM actually assigned to your specific deployment
- ⚠️ **You can have high regional quota but low deployment allocation** - this causes 429 errors!
- 💡 **Solution:** Scale your deployment to use more of the available quota

**Common Mistake:**
Seeing "50K TPM quota available" and thinking your deployment has 50K TPM. In reality, your deployment might only have 1K TPM allocated from that 50K pool!

**Typical Error Messages:**
```
Rate limit is exceeded. Try again in X seconds.
HTTP 429: Too Many Requests
RetryAfter: 60
```

## Understanding SKU Types

Azure OpenAI/Foundry deployments use different SKU types, each with separate quota pools:

| SKU Type | Description | Quota Pool | Use Case |
|----------|-------------|------------|----------|
| **GlobalStandard** | Global pay-as-you-go | Shared global quota | Multi-region, flexible workloads |
| **DataZoneStandard** | Data residency pay-as-you-go | Regional quota with data residency | Compliance requirements, data sovereignty |
| **Standard** | Regional standard (legacy) | Regional quota | Legacy deployments |
| **ProvisionedManaged** | Provisioned throughput | Dedicated capacity | Predictable, high-volume workloads |

**Critical:** Different SKUs have separate quota pools! A deployment using `DataZoneStandard` will NOT consume `GlobalStandard` quota.

**How to check your deployment's SKU:**
```bash
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, sku:sku.name, capacity:sku.capacity}"
```

**When troubleshooting 429 errors:**
1. Identify your deployment's SKU type
2. Check quota for that specific SKU (e.g., `OpenAI.DataZoneStandard.gpt-5.1`)
3. Ensure you're requesting quota increase for the correct SKU type

## Diagnostic Workflow

Follow this systematic approach to diagnose and resolve rate limiting:

### 1. Check Current Quota Usage

Determine if you're hitting quota limits.

**Bash:**
```bash
# Check all quota usage for the region
az cognitiveservices usage list \
  --location <region> \
  --query "[].{Name:name.value, Current:currentValue, Limit:limit, Unit:unit}" \
  --output table

# Example: Check East US 2 quota
az cognitiveservices usage list \
  --location eastus2 \
  --query "[?contains(name.value, 'gpt')].{Name:name.value, Current:currentValue, Limit:limit}" \
  --output table

# Check specific deployment capacity and rate limits
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, model:properties.model.name, sku:sku.name, capacity:sku.capacity, rateLimits:properties.rateLimits}" \
  --output json
```

**What to Look For:**
- `currentValue` approaching `limit` → quota exhaustion
- `limit` of 0 or null → no quota assigned
- `Unit: "Count"` → 1 unit typically = 1K TPM (varies by model)
- `sku.capacity` showing `null` → check `rateLimits` instead for actual TPM/RPM
- Multiple deployments → may be competing for shared quota pool

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

Ensure sufficient capacity is allocated. **Important:** `sku.capacity` often shows `null` for pay-as-you-go deployments. Always check `rateLimits` for actual TPM/RPM allocation.

**Bash:**
```bash
# List all deployments with SKU and capacity
az cognitiveservices account deployment list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query "[].{Name:name, Model:properties.model.name, SKU:sku.name, Capacity:sku.capacity, Status:properties.provisioningState}" \
  --output table

# Check actual rate limits for a specific deployment (CRITICAL!)
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, model:properties.model.name, sku:sku.name, capacity:sku.capacity, rateLimits:properties.rateLimits}" \
  --output json
```

**Example output showing actual limits:**
```json
{
  "name": "gpt-5.1",
  "model": "gpt-5.1",
  "sku": "DataZoneStandard",
  "capacity": 2,
  "rateLimits": [
    {"key": "request", "count": 20, "renewalPeriod": 60},
    {"key": "token", "count": 2000, "renewalPeriod": 60}
  ]
}
```
This shows **2000 TPM** and **20 RPM** actual limits.

**Capacity Guidelines:**
- Capacity units vary by model (e.g., 1K TPM per unit for most GPT models)
- **1 unit = 1K TPM** is typical (e.g., capacity: 2 = 2000 TPM)
- Minimum: 1 unit
- Maximum: Region and quota dependent
- **Always verify `rateLimits`** - this shows the true TPM/RPM limits

### 3.5. Analyze TPM Allocation Across Deployments

Understanding how TPM is distributed across all your deployments helps identify quota exhaustion.

**Diagnostic Script:**
```bash
# Save all deployments to file and analyze with Python
az cognitiveservices account deployment list \
  --name <resource-name> \
  --resource-group <resource-group> \
  -o json > /tmp/deployments.json

python3 << 'EOF'
import json

with open('/tmp/deployments.json') as f:
    deployments = json.load(f)

print("\n" + "="*60)
print("DEPLOYMENT TPM ALLOCATION ANALYSIS")
print("="*60)

total_tpm = 0
deployments_with_limits = []

for d in deployments:
    name = d['name']
    model = d['properties']['model']['name']
    sku = d.get('sku', {}).get('name', 'N/A')
    rate_limits = d['properties'].get('rateLimits', [])

    token_limit = next((r['count'] for r in rate_limits if r['key'] == 'token'), 0)
    request_limit = next((r['count'] for r in rate_limits if r['key'] == 'request'), 0)

    if token_limit > 0:
        deployments_with_limits.append({
            'name': name,
            'model': model,
            'sku': sku,
            'tpm': token_limit,
            'rpm': request_limit
        })
        total_tpm += token_limit

# Print deployments sorted by TPM
print(f"\n{'Deployment':<25} {'Model':<20} {'SKU':<20} {'TPM':>10} {'RPM':>8}")
print("-"*60)

for d in sorted(deployments_with_limits, key=lambda x: x['tpm'], reverse=True):
    print(f"{d['name']:<25} {d['model']:<20} {d['sku']:<20} {d['tpm']:>10.0f} {d['rpm']:>8.0f}")

print("-"*60)
print(f"{'TOTAL ALLOCATED':<65} {total_tpm:>10.0f} TPM")
print("\nℹ️  Compare with regional quota to see available capacity")
print("="*60 + "\n")
EOF
```

**Example Output:**
```
============================================================
DEPLOYMENT TPM ALLOCATION ANALYSIS
============================================================

Deployment                Model                SKU                        TPM      RPM
------------------------------------------------------------
gpt-5.1-codex             gpt-5.1-codex        GlobalStandard          100000      100
gpt-5.2-codex             gpt-5.2-codex        GlobalStandard          100000      100
gpt-4.1                   gpt-4.1              GlobalStandard           50000       50
computer-use-preview      computer-use-preview DataZoneStandard         30000       30
gpt-5.1                   gpt-5.1              DataZoneStandard          2000       20
------------------------------------------------------------
TOTAL ALLOCATED                                             282000 TPM

ℹ️  Compare with regional quota to see available capacity
============================================================
```

**Key Insights:**
- Shows which deployments consume most TPM
- Reveals SKU types (different SKUs = different quota pools)
- Helps identify over-allocation or unused deployments
- Compare total with regional quota to see available capacity

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

#### Option A: Scale Deployment Capacity (Within Existing Quota)

If you have available regional quota, scale your deployment directly. **Note:** Azure CLI doesn't have a deployment `update` command - use REST API instead.

**Via REST API:**
```bash
# Update deployment capacity (requires SKU name and new capacity)
az rest --method PUT \
  --url "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<resource-name>/deployments/<deployment-name>?api-version=2023-05-01" \
  --body '{
    "sku": {
      "name": "<SKU-type>",
      "capacity": <new-capacity>
    },
    "properties": {
      "model": {
        "format": "OpenAI",
        "name": "<model-name>",
        "version": "<model-version>"
      },
      "versionUpgradeOption": "OnceNewDefaultVersionAvailable"
    }
  }'
```

**Example: Scale gpt-5.1 from 1K to 2K TPM:**
```bash
# First, get current deployment details
az cognitiveservices account deployment show \
  --name alfredo-eastus2-resource \
  --resource-group rg-alfredo \
  --deployment-name gpt-5.1 \
  --query "{sku:sku.name, version:properties.model.version}"

# Then scale (capacity: 1 → 2 = 1K TPM → 2K TPM)
az rest --method PUT \
  --url "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-alfredo/providers/Microsoft.CognitiveServices/accounts/alfredo-eastus2-resource/deployments/gpt-5.1?api-version=2023-05-01" \
  --body '{
    "sku": {
      "name": "DataZoneStandard",
      "capacity": 2
    },
    "properties": {
      "model": {
        "format": "OpenAI",
        "name": "gpt-5.1",
        "version": "2025-11-13"
      },
      "versionUpgradeOption": "OnceNewDefaultVersionAvailable"
    }
  }'
```

**Common Errors:**
- `InsufficientQuota` → Need to request quota increase (see Option B)
- `InvalidResourceProperties - SKU not supported` → Wrong SKU type, check deployment's current SKU
- `The sku of model deployment is not provided` → Must include `sku` in request body

**Verification:**
```bash
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{capacity:sku.capacity, rateLimits:properties.rateLimits}"
```

#### Option B: Request Quota Increase

For sustained high usage:

1. **Check current limits:**
   ```bash
   # Check regional quota for specific model
   az cognitiveservices usage list \
     --location <region> \
     --query "[?name.value=='OpenAI.GlobalStandard.<model-name>'].{Name:name.value, Current:currentValue, Limit:limit, Unit:unit}" \
     --output table

   # Example: Check gpt-5.1 quota in East US 2
   az cognitiveservices usage list \
     --location eastus2 \
     --query "[?contains(name.value, 'gpt-5.1')].{Name:name.value, Current:currentValue, Limit:limit}" \
     --output table
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

- [ ] **Check deployment rate limits** - Run `deployment show` and verify `rateLimits` TPM/RPM
- [ ] **Identify SKU type** - Is it GlobalStandard, DataZoneStandard, or Standard?
- [ ] **Check regional quota** - For the correct SKU+model combination
- [ ] **Compare quota vs allocation** - Do you have available quota but low deployment allocation?
- [ ] **Review error logs** - When and how often? Check Retry-After values
- [ ] **Verify regional quota usage** - At or near limits for your SKU type?
- [ ] **Check retry logic** - Exponential backoff with Retry-After header implemented?
- [ ] **Identify usage patterns** - Peak times or constant load?
- [ ] **Review request sizes** - Token counts optimal?
- [ ] **Check concurrent requests** - Exceeding limits?
- [ ] **Analyze all deployments** - Other deployments consuming shared quota?
- [ ] **Consider multi-region** - Would distributed load help?

## Common Issues & Quick Fixes

| Issue | Cause | Resolution |
|-------|-------|------------|
| Constant 429 errors | Sustained over-quota | Request quota increase or scale to multiple regions |
| Intermittent 429s | Burst traffic | Implement request queuing or burst quota |
| 429 during peak hours only | Time-based spike | Scale up capacity during peak times |
| **429 with low usage** | **Deployment has low TPM allocation** | Check `rateLimits` in deployment (not just regional quota). Scale deployment capacity with REST API |
| **429 but quota shows available** | **Regional quota ≠ deployment allocation** | You have regional quota but deployment only allocated small portion. Scale deployment to use more quota |
| **`sku.capacity` shows null** | **Pay-as-you-go deployment** | This is normal for GlobalStandard/DataZoneStandard. Check `rateLimits` instead for actual TPM/RPM |
| **InsufficientQuota error when scaling** | **All regional quota allocated** | Free up capacity from other deployments or request quota increase |
| **Wrong SKU error when updating** | **SKU type mismatch** | Check deployment's actual SKU (`DataZoneStandard` vs `GlobalStandard`) and use correct one in update |
| High Retry-After values (>30 sec) | Severe rate violation | Check for request loops/bugs, reduce rate significantly |
| 429 on specific operations | Operation-specific limits | Check operation quotas separately |
| No 429 but slow responses | Approaching limits | Proactively increase quota before hitting limit |
| **429 across multiple models** | **Shared subscription quota** | Each model+SKU has separate quota. Check usage per model |

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
