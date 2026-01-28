# Azure AI Gateway Policy Reference

This document contains detailed policy patterns for governing AI models, MCP tools, and agents through Azure API Management.

## Table of Contents

### Model Governance
- [Semantic Caching](#semantic-caching)
- [Token Rate Limiting](#token-rate-limiting)
- [Token Metrics](#token-metrics)
- [Load Balancing with Retry](#load-balancing-with-retry)
- [Managed Identity Authentication](#managed-identity-authentication)

### Tool Governance (MCP Servers)
- [Request Rate Limiting](#request-rate-limiting)

### Agent Governance
- [Content Safety](#content-safety)

### Complete Examples
- [Combining Policies](#combining-policies)

---

# Model Governance Policies

## Semantic Caching

Cache similar prompts to reduce costs and latency.

```xml
<policies>
    <inbound>
        <base />
        <!-- Cache lookup with 0.8 similarity threshold -->
        <azure-openai-semantic-cache-lookup 
            score-threshold="0.8" 
            embeddings-backend-id="embeddings-backend" 
            embeddings-backend-auth="system-assigned" />
        <set-backend-service backend-id="{backend-id}" />
    </inbound>
    <outbound>
        <!-- Cache responses for 120 seconds -->
        <azure-openai-semantic-cache-store duration="120" />
        <base />
    </outbound>
</policies>
```

### Configuration Options

| Parameter | Range | Description |
|-----------|-------|-------------|
| `score-threshold` | 0.7-0.95 | Higher = stricter matching. Use 0.7-0.8 for broader caching, 0.9+ for exact matching |
| `duration` | 60-3600 | Cache TTL in seconds. Start with 120, adjust based on content freshness needs |
| `embeddings-backend-id` | string | Backend ID for embeddings model |
| `embeddings-backend-auth` | system-assigned, user-assigned | Authentication method for embeddings backend |

### When to Use

- Reduce costs on repetitive or similar queries (60-80% savings possible)
- Lower latency for common prompts
- FAQ-style applications with predictable queries

### Tips

- Start with `score-threshold="0.8"` and adjust based on cache hit rate
- Lower threshold = more cache hits but potentially less relevant responses
- Monitor cache metrics to optimize threshold

---

## Token Rate Limiting

Limit tokens per minute to control costs and prevent abuse.

```xml
<policies>
    <inbound>
        <base />
        <set-backend-service backend-id="{backend-id}" />
        <!-- Limit to 500 tokens per minute per subscription -->
        <azure-openai-token-limit 
            counter-key="@(context.Subscription.Id)"
            tokens-per-minute="500" 
            estimate-prompt-tokens="false" 
            remaining-tokens-variable-name="remainingTokens" />
    </inbound>
</policies>
```

### Configuration Options

| Parameter | Values | Description |
|-----------|--------|-------------|
| `counter-key` | Subscription.Id, Request.IpAddress, custom | Grouping key for limits |
| `tokens-per-minute` | 100-100000 | Token quota per key |
| `estimate-prompt-tokens` | true/false | true = faster but less accurate |
| `remaining-tokens-variable-name` | string | Variable to store remaining tokens |

### Counter Key Examples

```xml
<!-- Per subscription -->
counter-key="@(context.Subscription.Id)"

<!-- Per IP address -->
counter-key="@(context.Request.IpAddress)"

<!-- Per user (from JWT claim) -->
counter-key="@(context.Request.Headers.GetValueOrDefault('Authorization','').AsJwt()?.Claims['sub'])"

<!-- Per API key header -->
counter-key="@(context.Request.Headers.GetValueOrDefault('X-API-Key','anonymous'))"
```

### When to Use

- Control costs by limiting token consumption
- Prevent single user from exhausting quota
- Implement tiered pricing based on subscription level

---

## Content Safety

Filter harmful content and detect jailbreak attempts.

```xml
<policies>
    <inbound>
        <base />
        <set-backend-service backend-id="{backend-id}" />
        <!-- Block severity 4+ content, detect jailbreaks -->
        <llm-content-safety backend-id="content-safety-backend" shield-prompt="true">
            <categories output-type="EightSeverityLevels">
                <category name="Hate" threshold="4" />
                <category name="Sexual" threshold="4" />
                <category name="SelfHarm" threshold="4" />
                <category name="Violence" threshold="4" />
            </categories>
            <blocklists>
                <id>custom-blocklist</id>
            </blocklists>
        </llm-content-safety>
    </inbound>
</policies>
```

### Configuration Options

| Parameter | Range | Description |
|-----------|-------|-------------|
| `threshold` | 0-7 | 0=safe, 7=severe. Start with 4 for balanced filtering |
| `shield-prompt` | true/false | Detect jailbreak attempts |
| `output-type` | FourSeverityLevels, EightSeverityLevels | Granularity of severity levels |

### Categories

| Category | Description |
|----------|-------------|
| `Hate` | Hate speech, discrimination |
| `Sexual` | Sexual content |
| `SelfHarm` | Self-harm content |
| `Violence` | Violent content |

### Threshold Guidance

| Threshold | Use Case |
|-----------|----------|
| 0-2 | Very strict filtering (children's apps) |
| 3-4 | Balanced filtering (general use) |
| 5-6 | Permissive (adult audiences with warnings) |
| 7 | Only block extreme content |

### When to Use

- Consumer-facing AI applications
- Compliance requirements
- Protecting brand reputation

---

## Request Rate Limiting

Protect MCP servers and tools with request rate limiting.

```xml
<policies>
    <inbound>
        <base />
        <!-- 10 calls per 60 seconds per IP -->
        <rate-limit-by-key 
            calls="10" 
            renewal-period="60" 
            counter-key="@(context.Request.IpAddress)" 
            remaining-calls-variable-name="remainingCalls" />
    </inbound>
    <outbound>
        <set-header name="X-Rate-Limit-Remaining" exists-action="override">
            <value>@(context.Variables.GetValueOrDefault<int>("remainingCalls", 0).ToString())</value>
        </set-header>
        <base />
    </outbound>
</policies>
```

### Configuration Options

| Parameter | Description |
|-----------|-------------|
| `calls` | Number of calls allowed per period |
| `renewal-period` | Time window in seconds |
| `counter-key` | Grouping key (IP, subscription, custom) |
| `remaining-calls-variable-name` | Variable for remaining calls |

### When to Use

- Protect MCP servers from abuse
- Rate limit tool calls from AI agents
- Prevent DDoS on API endpoints

---

## Managed Identity Authentication

Secure backend access with managed identity instead of API keys.

```xml
<policies>
    <inbound>
        <base />
        <!-- Managed identity auth to Azure OpenAI -->
        <authentication-managed-identity 
            resource="https://cognitiveservices.azure.com" 
            output-token-variable-name="managed-id-access-token" 
            ignore-error="false" />
        <set-header name="Authorization" exists-action="override">
            <value>@("Bearer " + (string)context.Variables["managed-id-access-token"])</value>
        </set-header>
        <set-backend-service backend-id="{backend-id}" />
    </inbound>
</policies>
```

### Resource URLs

| Service | Resource URL |
|---------|--------------|
| Azure OpenAI | `https://cognitiveservices.azure.com` |
| Azure AI Services | `https://cognitiveservices.azure.com` |
| Azure Storage | `https://storage.azure.com` |
| Azure Key Vault | `https://vault.azure.net` |

### Required Role Assignments

```bash
# Assign Cognitive Services User role to APIM managed identity
az role assignment create \
  --assignee <apim-principal-id> \
  --role "Cognitive Services User" \
  --scope <azure-openai-resource-id>
```

### When to Use

- Production environments (avoid API keys)
- Secure backend access
- Centralized credential management

---

## Load Balancing with Retry

Distribute load across multiple backends with automatic failover.

```xml
<policies>
    <inbound>
        <base />
        <set-backend-service backend-id="{backend-pool-id}" />
    </inbound>
    <backend>
        <!-- Retry on 429 (rate limit) or 503 (service unavailable) -->
        <retry count="2" interval="0" first-fast-retry="true" 
            condition="@(context.Response.StatusCode == 429 || context.Response.StatusCode == 503)">
            <set-backend-service backend-id="{backend-pool-id}" />
            <forward-request buffer-request-body="true" />
        </retry>
    </backend>
    <on-error>
        <when condition="@(context.Response.StatusCode == 503)">
            <return-response>
                <set-status code="503" reason="Service Unavailable" />
            </return-response>
        </when>
    </on-error>
</policies>
```

### Configuration Options

| Parameter | Description |
|-----------|-------------|
| `count` | Number of retry attempts |
| `interval` | Delay between retries (seconds) |
| `first-fast-retry` | Skip delay on first retry |
| `condition` | When to retry (status codes) |

### Backend Pool Configuration (Bicep)

```bicep
resource backendPool 'Microsoft.ApiManagement/service/backends@2024-06-01-preview' = {
  parent: apimService
  name: 'openai-backend-pool'
  properties: {
    type: 'Pool'
    pool: {
      services: [
        { id: '/backends/openai-eastus' }
        { id: '/backends/openai-westus' }
      ]
    }
  }
}
```

### When to Use

- High availability requirements
- Geographic load distribution
- Handling rate limits across regions

---

## Token Metrics

Emit token metrics for monitoring and cost tracking.

```xml
<policies>
    <inbound>
        <base />
        <set-backend-service backend-id="{backend-id}" />
        <!-- Emit token metrics for monitoring -->
        <azure-openai-emit-token-metric namespace="openai">
            <dimension name="Subscription ID" value="@(context.Subscription.Id)" />
            <dimension name="Client IP" value="@(context.Request.IpAddress)" />
            <dimension name="API ID" value="@(context.Api.Id)" />
            <dimension name="Model" value="@(context.Request.Headers.GetValueOrDefault("x-model","unknown"))" />
        </azure-openai-emit-token-metric>
    </inbound>
</policies>
```

### Available Dimensions

| Dimension | Value Example | Use Case |
|-----------|---------------|----------|
| Subscription ID | `context.Subscription.Id` | Cost allocation per customer |
| Client IP | `context.Request.IpAddress` | Usage tracking per client |
| API ID | `context.Api.Id` | Usage per API |
| Operation ID | `context.Operation.Id` | Usage per endpoint |
| Product ID | `context.Product.Id` | Usage per product tier |
| User ID | JWT claim | Per-user tracking |

### When to Use

- Cost tracking and chargebacks
- Usage monitoring per customer
- Capacity planning

---

## Combining Policies

Policies can be combined for comprehensive protection:

```xml
<policies>
    <inbound>
        <base />
        <!-- 1. Authenticate with managed identity -->
        <authentication-managed-identity 
            resource="https://cognitiveservices.azure.com" 
            output-token-variable-name="managed-id-access-token" />
        <set-header name="Authorization" exists-action="override">
            <value>@("Bearer " + (string)context.Variables["managed-id-access-token"])</value>
        </set-header>
        
        <!-- 2. Check semantic cache -->
        <azure-openai-semantic-cache-lookup 
            score-threshold="0.8" 
            embeddings-backend-id="embeddings-backend" />
        
        <!-- 3. Apply token limits -->
        <azure-openai-token-limit 
            counter-key="@(context.Subscription.Id)"
            tokens-per-minute="1000" />
        
        <!-- 4. Content safety -->
        <llm-content-safety backend-id="content-safety-backend" shield-prompt="true">
            <categories output-type="EightSeverityLevels">
                <category name="Hate" threshold="4" />
                <category name="Violence" threshold="4" />
            </categories>
        </llm-content-safety>
        
        <!-- 5. Set backend -->
        <set-backend-service backend-id="openai-backend-pool" />
        
        <!-- 6. Emit metrics -->
        <azure-openai-emit-token-metric namespace="openai">
            <dimension name="Subscription ID" value="@(context.Subscription.Id)" />
        </azure-openai-emit-token-metric>
    </inbound>
    <outbound>
        <azure-openai-semantic-cache-store duration="120" />
        <base />
    </outbound>
</policies>
```

---

## References

- [GenAI Gateway Capabilities](https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities)
- [Semantic Caching](https://learn.microsoft.com/en-us/azure/api-management/azure-openai-enable-semantic-caching)
- [Token Limits & LLM Logs](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-llm-logs)
- [APIM Policies Reference](https://learn.microsoft.com/azure/api-management/api-management-policies)
