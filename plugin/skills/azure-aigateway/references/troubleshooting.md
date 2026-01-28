# Azure AI Gateway Troubleshooting Guide

Common issues and solutions when working with Azure API Management as an AI Gateway.

## Quick Reference

| Issue | Symptom | Solution |
|-------|---------|----------|
| Slow APIM creation | Deployment takes 30+ minutes | Use Basicv2 SKU instead of Premium |
| Token limit exceeded | 429 response | Increase `tokens-per-minute` or add load balancing |
| Cache not working | No cache hits | Lower `score-threshold` (e.g., 0.7) |
| Content blocked | False positives | Increase category thresholds |
| Backend auth fails | 401 from Azure OpenAI | Assign Cognitive Services User role to APIM managed identity |
| Rate limit too strict | Legitimate requests blocked | Increase `calls` or `renewal-period` |

---

## Detailed Solutions

### Slow APIM Creation

**Problem:** APIM deployment takes 30+ minutes

**Cause:** Premium and Developer SKUs take longer to provision

**Solution:** Use Basicv2 SKU for faster provisioning (~5-10 minutes)

```bash
# Use Basicv2 SKU
az deployment group create \
  --resource-group rg-aigateway \
  --template-file main.bicep \
  --parameters apimSku=Basicv2
```

---

### Token Limit Exceeded (429)

**Problem:** Requests failing with 429 "Too Many Requests"

**Causes:**
- Token limit too low for workload
- Single backend at capacity

**Solutions:**

1. **Increase token limit:**
```xml
<azure-openai-token-limit 
    tokens-per-minute="5000"  <!-- Increase from default -->
    counter-key="@(context.Subscription.Id)" />
```

2. **Add load balancing across backends:**
```xml
<set-backend-service backend-id="openai-backend-pool" />
<retry count="2" interval="0" first-fast-retry="true" 
    condition="@(context.Response.StatusCode == 429)">
    <set-backend-service backend-id="openai-backend-pool" />
    <forward-request buffer-request-body="true" />
</retry>
```

3. **Check current token usage:**
```bash
# View token metrics in Application Insights
az monitor metrics list \
  --resource <apim-resource-id> \
  --metric "TokenUsage" \
  --interval PT1H
```

---

### Semantic Cache Not Working

**Problem:** No cache hits, all requests going to backend

**Causes:**
- Score threshold too high
- Embeddings backend not configured
- Cache duration expired

**Solutions:**

1. **Lower score threshold:**
```xml
<!-- Lower from 0.9 to 0.7 for broader matching -->
<azure-openai-semantic-cache-lookup 
    score-threshold="0.7" 
    embeddings-backend-id="embeddings-backend" />
```

2. **Verify embeddings backend exists:**
```bash
az apim backend show \
  --resource-group <rg> \
  --service-name <apim-name> \
  --backend-id embeddings-backend
```

3. **Increase cache duration:**
```xml
<azure-openai-semantic-cache-store duration="3600" />  <!-- 1 hour -->
```

4. **Check cache metrics:**
```bash
# Look for CacheHit vs CacheMiss in APIM metrics
az monitor metrics list \
  --resource <apim-resource-id> \
  --metric "CacheHitCount,CacheMissCount"
```

---

### Content Safety False Positives

**Problem:** Legitimate content being blocked

**Cause:** Category thresholds too strict

**Solutions:**

1. **Increase category thresholds:**
```xml
<llm-content-safety backend-id="content-safety-backend">
    <categories output-type="EightSeverityLevels">
        <!-- Increase from 2 to 4 for less strict filtering -->
        <category name="Hate" threshold="4" />
        <category name="Sexual" threshold="4" />
        <category name="SelfHarm" threshold="4" />
        <category name="Violence" threshold="4" />
    </categories>
</llm-content-safety>
```

2. **Review blocked content:**
```bash
# Check APIM diagnostic logs for blocked requests
az monitor diagnostic-settings list \
  --resource <apim-resource-id>
```

3. **Use custom blocklists for fine-grained control:**
```xml
<blocklists>
    <id>custom-blocklist</id>  <!-- Only block specific terms -->
</blocklists>
```

---

### Backend Authentication Fails (401)

**Problem:** 401 Unauthorized from Azure OpenAI or AI Foundry

**Causes:**
- APIM managed identity not assigned role
- Wrong resource URL in authentication policy
- System-assigned identity not enabled

**Solutions:**

1. **Enable system-assigned managed identity:**
```bash
az apim update \
  --name <apim-name> \
  --resource-group <rg> \
  --set identity.type=SystemAssigned
```

2. **Assign Cognitive Services User role:**
```bash
# Get APIM principal ID
APIM_PRINCIPAL_ID=$(az apim show \
  --name <apim-name> \
  --resource-group <rg> \
  --query "identity.principalId" -o tsv)

# Assign role
az role assignment create \
  --assignee $APIM_PRINCIPAL_ID \
  --role "Cognitive Services User" \
  --scope <azure-openai-resource-id>
```

3. **Verify correct resource URL:**
```xml
<!-- For Azure OpenAI / AI Services -->
<authentication-managed-identity 
    resource="https://cognitiveservices.azure.com" />
```

4. **Check role assignment:**
```bash
az role assignment list \
  --assignee $APIM_PRINCIPAL_ID \
  --scope <azure-openai-resource-id>
```

---

### Rate Limit Too Strict

**Problem:** Legitimate users being rate limited

**Cause:** Rate limit configuration too restrictive

**Solutions:**

1. **Increase rate limit:**
```xml
<rate-limit-by-key 
    calls="100"  <!-- Increase from 10 -->
    renewal-period="60" 
    counter-key="@(context.Subscription.Id)" />
```

2. **Use different counter key for granular control:**
```xml
<!-- Rate limit per subscription instead of per IP -->
<rate-limit-by-key 
    calls="1000" 
    renewal-period="60" 
    counter-key="@(context.Subscription.Id)" />
```

3. **Implement tiered rate limits by product:**
```xml
<choose>
    <when condition="@(context.Product.Name == 'Premium')">
        <rate-limit-by-key calls="1000" renewal-period="60" 
            counter-key="@(context.Subscription.Id)" />
    </when>
    <otherwise>
        <rate-limit-by-key calls="100" renewal-period="60" 
            counter-key="@(context.Subscription.Id)" />
    </otherwise>
</choose>
```

---

### MCP Server Not Responding

**Problem:** MCP tools/list or tools/call endpoints not working

**Causes:**
- MCP operations not configured
- Policy not applied to MCP endpoints
- Subscription key not provided

**Solutions:**

1. **Verify MCP operations exist:**
```bash
az apim api operation list \
  --resource-group <rg> \
  --service-name <apim-name> \
  --api-id <api-id> \
  --query "[?contains(urlTemplate, 'mcp')]"
```

2. **Check policy is applied:**
```bash
az apim api operation policy show \
  --resource-group <rg> \
  --service-name <apim-name> \
  --api-id <api-id> \
  --operation-id mcp-tools-list
```

3. **Test with subscription key:**
```bash
curl -X POST "${GATEWAY_URL}/api/mcp/tools/list" \
  -H "Content-Type: application/json" \
  -H "Ocp-Apim-Subscription-Key: <subscription-key>" \
  -d '{}'
```

---

### APIM Not Finding Backend

**Problem:** Backend service not found errors

**Causes:**
- Backend ID mismatch in policy
- Backend not created
- Backend URL incorrect

**Solutions:**

1. **List existing backends:**
```bash
az apim backend list \
  --resource-group <rg> \
  --service-name <apim-name> \
  --query "[].{id:name, url:url}"
```

2. **Create missing backend:**
```bash
az apim backend create \
  --resource-group <rg> \
  --service-name <apim-name> \
  --backend-id my-backend \
  --protocol http \
  --url "https://my-service.azure.com"
```

3. **Verify backend ID in policy matches:**
```xml
<!-- Ensure this ID matches az apim backend list output -->
<set-backend-service backend-id="my-backend" />
```

---

## Diagnostic Commands

### Check APIM Status
```bash
az apim show --name <apim-name> --resource-group <rg> --query "provisioningState"
```

### View Recent API Calls
```bash
az monitor activity-log list \
  --resource-group <rg> \
  --query "[?contains(operationName.value, 'Microsoft.ApiManagement')]"
```

### Check Policy Syntax
```bash
# Get policy XML and validate
az apim api policy show \
  --resource-group <rg> \
  --service-name <apim-name> \
  --api-id <api-id>
```

### Test Backend Connectivity
```bash
# From APIM, test backend URL
az apim api operation invoke \
  --resource-group <rg> \
  --service-name <apim-name> \
  --api-id <api-id> \
  --operation-id <operation-id>
```

---

## Getting Help

- [Azure API Management Documentation](https://learn.microsoft.com/azure/api-management/)
- [AI Gateway Samples Repository](https://github.com/Azure-Samples/AI-Gateway)
- [APIM Troubleshooting Guide](https://learn.microsoft.com/azure/api-management/api-management-howto-troubleshoot)
