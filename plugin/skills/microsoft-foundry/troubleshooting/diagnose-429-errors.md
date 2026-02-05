# Diagnose Rate Limiting (429 Errors) in Microsoft Foundry

This reference provides guidance for diagnosing and resolving HTTP 429 (Rate Limit Exceeded) errors in Microsoft Foundry, including quota analysis, usage patterns, and retry strategies.

## Quick Reference

| Property | Value |
|----------|-------|
| **Error Type** | HTTP 429 - Too Many Requests |
| **Common Causes** | Quota exceeded, burst limits, concurrent requests |
| **CLI Commands** | `az cognitiveservices usage`, `az cognitiveservices account deployment show` |
| **Best For** | Debugging rate limits, capacity planning, retry optimization |

## When to Use

Use this reference when the user encounters:

- **"Rate limit exceeded"** errors (HTTP 429)
- **Model deployment failures** due to capacity
- **Slow or throttled** API responses
- **Quota planning** for production workloads
- **Retry strategy optimization**
- Questions like "Why am I getting rate limited?"

## Understanding Rate Limiting in Microsoft Foundry

### Rate Limit Types

Microsoft Foundry enforces several types of rate limits:

| Limit Type | Scope | Description |
|------------|-------|-------------|
| **TPM (Tokens Per Minute)** | Deployment | Total tokens processed per minute |
| **RPM (Requests Per Minute)** | Deployment | Total requests per minute |
| **Concurrent Requests** | Deployment | Maximum simultaneous requests |
| **Burst Limits** | Deployment | Short-term spike allowance |
| **Regional Capacity** | Region | Shared capacity across subscriptions |

### Common Error Messages

```
Rate limit is exceeded. Try again in X seconds.
HTTP 429: Too Many Requests
TooManyRequests: Rate limit reached for requests
RetryAfter: 60
```

## Workflows

### 1. Check Current Quota and Usage

Diagnose if you're hitting quota limits by checking current usage and limits.

**Command Pattern:** "Check my current quota usage"

#### Bash
```bash
# Check all quota usage for a Foundry resource
az cognitiveservices usage list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --output table

# Get detailed usage with JSON output
az cognitiveservices usage list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --output json | jq '.[] | {name: .name.value, currentValue: .currentValue, limit: .limit}'

# Check specific deployment quota
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, capacity:properties.sku.capacity, model:properties.model.name}" \
  --output table
```

#### PowerShell
```powershell
# Check quota usage
az cognitiveservices usage list `
  --name <foundry-resource-name> `
  --resource-group <resource-group> `
  --output table

# Parse with PowerShell
az cognitiveservices usage list `
  --name <foundry-resource-name> `
  --resource-group <resource-group> `
  --output json | ConvertFrom-Json | Select-Object @{N='Name';E={$_.name.value}}, currentValue, limit
```

**What to Look For:**
- `currentValue` approaching `limit` indicates quota exhaustion
- `limit` of 0 or null indicates no quota assigned
- Multiple deployments sharing quota may compete for capacity

### 2. Analyze Recent 429 Errors

Review Azure Monitor logs to understand rate limiting patterns.

**Command Pattern:** "Show me recent rate limit errors"

#### Using Azure Monitor (Portal)

1. Navigate to your Foundry resource in Azure Portal
2. Go to **Monitoring** > **Logs**
3. Run this KQL query:

```kql
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
| where ResultType == "429"
| where TimeGenerated > ago(24h)
| project TimeGenerated, OperationName, ResultType, DurationMs, CallerIPAddress
| order by TimeGenerated desc
```

#### Using Azure CLI
```bash
# Query Azure Monitor logs for 429 errors
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "AzureDiagnostics | where ResourceProvider == 'MICROSOFT.COGNITIVESERVICES' | where ResultType == '429' | where TimeGenerated > ago(24h) | project TimeGenerated, OperationName, ResultType | order by TimeGenerated desc" \
  --output table
```

**Patterns to Identify:**
- **Consistent 429s**: Indicates sustained over-quota usage
- **Burst 429s**: Temporary spikes, may need burst quota increase
- **Time-of-day patterns**: Identifies peak usage periods
- **Specific operations**: Some endpoints may be more limited

### 3. Check Deployment Capacity

Verify your deployment has sufficient capacity allocated.

**Command Pattern:** "What's my deployment capacity?"

#### Bash
```bash
# List all deployments with capacity
az cognitiveservices account deployment list \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query "[].{Name:name, Model:properties.model.name, Capacity:properties.sku.capacity, Status:properties.provisioningState}" \
  --output table

# Check specific deployment details
az cognitiveservices account deployment show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --output json | jq '{name: .name, model: .properties.model.name, capacity: .properties.sku.capacity, rateLimit: .properties.rateLimits}'
```

**Capacity Guidelines:**
- Capacity units vary by model (e.g., 1K TPM per unit for GPT-4)
- Minimum capacity: 1 unit
- Maximum capacity: Region and quota dependent
- Dynamic quota allows flexible scaling within limits

### 4. Implement Retry Logic with Exponential Backoff

Proper retry handling reduces error impact and respects rate limits.

**Command Pattern:** "How should I handle 429 errors in my code?"

#### Python Example
```python
import time
import random
from azure.core.exceptions import HttpResponseError

def call_with_retry(func, max_retries=5, base_delay=1):
    """
    Call a function with exponential backoff retry logic for 429 errors.

    Args:
        func: Function to call
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
    """
    for attempt in range(max_retries):
        try:
            return func()
        except HttpResponseError as e:
            if e.status_code == 429:
                if attempt == max_retries - 1:
                    raise  # Last attempt, re-raise the error

                # Get Retry-After header if available
                retry_after = e.response.headers.get('Retry-After')
                if retry_after:
                    delay = int(retry_after)
                else:
                    # Exponential backoff: 1s, 2s, 4s, 8s, 16s
                    delay = base_delay * (2 ** attempt)
                    # Add jitter to prevent thundering herd
                    delay += random.uniform(0, 1)

                print(f"Rate limited. Retrying in {delay:.1f}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            else:
                raise  # Not a 429 error, re-raise

# Usage example
response = call_with_retry(lambda: client.chat.completions.create(...))
```

**Best Practices:**
- **Always check Retry-After header** - Respect server-provided wait time
- **Use exponential backoff** - Double delay on each retry
- **Add jitter** - Randomize delays to prevent synchronized retries
- **Set max retries** - Prevent infinite loops (3-5 retries recommended)
- **Log retry attempts** - Monitor retry patterns

### 5. Request Quota Increase

If you consistently hit limits, request a quota increase.

**Command Pattern:** "Request quota increase for my deployment"

#### Steps to Request Increase

1. **Navigate to Azure Portal**:
   - Go to your Foundry resource
   - Select **Quotas** under **Resource Management**

2. **Identify the Quota to Increase**:
   ```bash
   # Check current quota limits
   az cognitiveservices usage list \
     --name <foundry-resource-name> \
     --resource-group <resource-group> \
     --query "[?name.value=='TokensPerMinute' || name.value=='RequestsPerMinute'].{Quota:name.value, Current:currentValue, Limit:limit}" \
     --output table
   ```

3. **Submit Quota Increase Request**:
   - In Azure Portal > Quotas, click **Request quota increase**
   - Select the model and deployment
   - Specify new quota amount
   - Provide business justification
   - Submit request

4. **Monitor Request Status**:
   - Check **Support > Support Requests** in Azure Portal
   - Typical approval time: 24-48 hours
   - May require escalation for large increases

**Quota Increase Guidelines:**

| Scenario | Recommended Action |
|----------|-------------------|
| Development/Testing | Start with 10K TPM, increase as needed |
| Production (Low Traffic) | 50K-100K TPM |
| Production (Medium Traffic) | 100K-500K TPM |
| Production (High Traffic) | 500K+ TPM, consider multiple regions |
| Burst Workloads | Request Dynamic Quota for automatic scaling |

### 6. Scale Across Multiple Deployments

Distribute load across multiple deployments to increase effective capacity.

**Command Pattern:** "Deploy models to multiple regions"

#### Multi-Region Strategy

```bash
# Deploy to primary region (East US)
az cognitiveservices account deployment create \
  --name foundry-eastus \
  --resource-group rg-eastus \
  --deployment-name gpt-4o-eastus \
  --model-name gpt-4o \
  --model-version "2024-05-13" \
  --model-format OpenAI \
  --sku-capacity 30 \
  --sku-name Standard

# Deploy to secondary region (West Europe)
az cognitiveservices account deployment create \
  --name foundry-westeurope \
  --resource-group rg-westeurope \
  --deployment-name gpt-4o-westeurope \
  --model-name gpt-4o \
  --model-version "2024-05-13" \
  --model-format OpenAI \
  --sku-capacity 30 \
  --sku-name Standard

# Deploy to tertiary region (Southeast Asia)
az cognitiveservices account deployment create \
  --name foundry-southeastasia \
  --resource-group rg-southeastasia \
  --deployment-name gpt-4o-southeastasia \
  --model-name gpt-4o \
  --model-version "2024-05-13" \
  --model-format OpenAI \
  --sku-capacity 30 \
  --sku-name Standard
```

**Load Balancing Pattern (Python):**

```python
import random
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential

# Define multiple endpoints
endpoints = [
    {"url": "https://foundry-eastus.cognitiveservices.azure.com", "key": "key1"},
    {"url": "https://foundry-westeurope.cognitiveservices.azure.com", "key": "key2"},
    {"url": "https://foundry-southeastasia.cognitiveservices.azure.com", "key": "key3"},
]

def get_client_with_fallback():
    """Try endpoints in order until one succeeds."""
    # Shuffle for load distribution
    shuffled = random.sample(endpoints, len(endpoints))

    for endpoint in shuffled:
        try:
            client = ChatCompletionsClient(
                endpoint=endpoint["url"],
                credential=AzureKeyCredential(endpoint["key"])
            )
            # Test connection
            return client
        except Exception as e:
            print(f"Failed to connect to {endpoint['url']}: {e}")
            continue

    raise Exception("All endpoints failed")

# Usage
client = get_client_with_fallback()
response = call_with_retry(lambda: client.complete(...))
```

**Benefits of Multi-Region Deployment:**
- Increased total capacity (quota per region)
- Geographic redundancy and failover
- Reduced latency for global users
- Better burst handling

## Diagnostic Checklist

Use this checklist to diagnose rate limiting issues:

- [ ] **Check current quota usage** - Are you at or near limits?
- [ ] **Review 429 error logs** - When and how often do errors occur?
- [ ] **Verify deployment capacity** - Is capacity allocated correctly?
- [ ] **Check retry logic** - Are retries implementing exponential backoff?
- [ ] **Identify usage patterns** - Are there specific peak times?
- [ ] **Consider multi-region** - Would distributed load help?
- [ ] **Review request sizes** - Are token counts optimal?
- [ ] **Check concurrent requests** - Are you exceeding concurrent limits?

## Common Issues and Resolutions

| Issue | Cause | Resolution |
|-------|-------|------------|
| Constant 429 errors | Sustained over-quota usage | Request quota increase or scale across regions |
| Intermittent 429 errors | Burst traffic exceeds limits | Implement request queuing or Dynamic Quota |
| 429 only during peak hours | Time-based load spike | Scale up capacity during peak times |
| 429 with low usage | Deployment not scaled properly | Increase deployment capacity |
| Retry-After header very high | Severe rate limit violation | Reduce request rate, check for loops/bugs |
| 429 on specific operations | Operation-specific limits | Check operation quotas separately |
| No 429 but slow responses | Approaching but not exceeding limits | Proactively increase quota |

## Best Practices

### Capacity Planning

1. **Monitor baseline usage** - Track TPM/RPM over time
2. **Plan for growth** - Request 20-30% more quota than needed
3. **Test at scale** - Load test before production launch
4. **Set up alerts** - Alert at 70-80% quota usage

### Code Optimization

```python
# Optimize token usage
def optimize_prompt(text, max_tokens=4000):
    """Truncate input to stay within token limits."""
    # Approximate: 1 token ≈ 4 characters
    max_chars = max_tokens * 4
    if len(text) > max_chars:
        return text[:max_chars] + "..."
    return text

# Batch similar requests
def batch_requests(requests, batch_size=10):
    """Process requests in batches to avoid overwhelming the API."""
    for i in range(0, len(requests), batch_size):
        batch = requests[i:i+batch_size]
        results = [call_with_retry(lambda: process(req)) for req in batch]
        # Brief pause between batches
        time.sleep(1)
        yield results
```

### Monitoring and Alerting

```bash
# Set up Azure Monitor alert for high 429 rate
az monitor metrics alert create \
  --name "High-Rate-Limit-Errors" \
  --resource <foundry-resource-id> \
  --condition "count HttpErrors where ResultType == 429 > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id>
```

## Additional Resources

- [Azure Cognitive Services Quotas and Limits](https://learn.microsoft.com/azure/cognitive-services/openai/quotas-limits)
- [Dynamic Quota Management](https://learn.microsoft.com/azure/cognitive-services/openai/how-to/dynamic-quota)
- [Monitoring OpenAI Models](https://learn.microsoft.com/azure/cognitive-services/openai/how-to/monitoring)
- [Rate Limiting Best Practices](https://learn.microsoft.com/azure/architecture/best-practices/retry-service-specific#azure-openai)
