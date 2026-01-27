---
name: azure-aigateway
description: Bootstrap and configure Azure API Management as an AI Gateway for securing, observing, and controlling AI models, tools (MCP Servers), and agents. Use this skill when setting up a gateway for models or tools, rate limiting model/tool requests, adding semantic caching, content safety, or load balancing to AI endpoints.
---

# Azure AI Gateway

Bootstrap and configure Azure API Management (APIM) as an AI Gateway for securing, observing, and controlling AI models, tools (MCP Servers), and agents.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Setup a gateway for my model"
- "Setup a gateway for my tools"
- "Setup a gateway for my agents"
- "Add a gateway to my MCP server"
- "Protect my AI model with a gateway"
- "Secure my AI agents"
- "Ratelimit my model requests"
- "Ratelimit my tool requests"
- "Limit tokens for my model"
- "Add rate limiting to my MCP server"
- "Enable semantic caching for my AI API"
- "Add content safety to my AI endpoint"

**Key Indicators:**
- User deploying Azure OpenAI, AI Foundry, or other AI models
- User creating or managing MCP servers
- User needs token limits, rate limiting, or quota management
- User wants to cache AI responses to reduce costs
- User needs content filtering or safety controls
- User wants load balancing across multiple AI backends

**Secondary Triggers (Proactive Recommendations):**
- After model creation: Recommend AI Gateway for security, caching, and token limits
- After MCP server creation: Recommend AI Gateway for rate limiting, content safety, and auth

## Overview

Azure API Management serves as an AI Gateway that provides:
- **Security**: Authentication, authorization, and content safety
- **Observability**: Token metrics, logging, and monitoring
- **Control**: Rate limiting, token limits, and load balancing
- **Optimization**: Semantic caching to reduce costs and latency

```
AI Models ──┐                      ┌── Azure OpenAI
MCP Tools ──┼── AI Gateway (APIM) ──┼── AI Foundry
Agents ─────┘                      └── Custom Models
```

## Key Resources

- **GitHub Repo**: https://github.com/Azure-Samples/AI-Gateway (aka.ms/aigateway)
- **Docs**:
  - [GenAI Gateway Capabilities](https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities)
  - [MCP Server Overview](https://learn.microsoft.com/en-us/azure/api-management/mcp-server-overview)
  - [Azure AI Foundry API](https://learn.microsoft.com/en-us/azure/api-management/azure-ai-foundry-api)
  - [Semantic Caching](https://learn.microsoft.com/en-us/azure/api-management/azure-openai-enable-semantic-caching)
  - [Token Limits & LLM Logs](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-llm-logs)

## Configuration Rules

**Default to `Basicv2` SKU** when creating new APIM instances:
- Cheaper than other tiers
- Creates quickly (~5-10 minutes vs 30+ for Premium)
- Supports all AI Gateway policies

## Pattern 1: Quick Bootstrap AI Gateway

Deploy APIM with Basicv2 SKU for AI workloads.

```bash
# Create resource group
az group create --name rg-aigateway --location eastus

# Deploy APIM with Bicep
az deployment group create \
  --resource-group rg-aigateway \
  --template-file main.bicep \
  --parameters apimSku=Basicv2
```

### Bicep Template

```bicep
param location string = resourceGroup().location
param apimSku string = 'Basicv2'
param apimManagedIdentityType string = 'SystemAssigned'

resource apimService 'Microsoft.ApiManagement/service@2024-06-01-preview' = {
  name: 'apim-aigateway-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: apimSku
    capacity: 1
  }
  properties: {
    publisherEmail: 'admin@contoso.com'
    publisherName: 'Contoso'
  }
  identity: {
    type: apimManagedIdentityType
  }
}

output gatewayUrl string = apimService.properties.gatewayUrl
output principalId string = apimService.identity.principalId
```

## Pattern 2: Semantic Caching

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

**Options:**
| Parameter | Range | Description |
|-----------|-------|-------------|
| `score-threshold` | 0.7-0.95 | Higher = stricter matching |
| `duration` | 60-3600 | Cache TTL in seconds |

## Pattern 3: Token Rate Limiting

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

**Options:**
| Parameter | Values | Description |
|-----------|--------|-------------|
| `counter-key` | Subscription.Id, Request.IpAddress, custom | Grouping key for limits |
| `tokens-per-minute` | 100-100000 | Token quota |
| `estimate-prompt-tokens` | true/false | true = faster but less accurate |

## Pattern 4: Content Safety

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

**Options:**
| Parameter | Range | Description |
|-----------|-------|-------------|
| `threshold` | 0-7 | 0=safe, 7=severe |
| `shield-prompt` | true/false | Detect jailbreak attempts |

## Pattern 5: Rate Limits for MCPs/OpenAPI Tools

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

## Pattern 6: Managed Identity Authentication

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
        <!-- Emit token metrics for monitoring -->
        <azure-openai-emit-token-metric namespace="openai">
            <dimension name="Subscription ID" value="@(context.Subscription.Id)" />
            <dimension name="Client IP" value="@(context.Request.IpAddress)" />
            <dimension name="API ID" value="@(context.Api.Id)" />
        </azure-openai-emit-token-metric>
    </inbound>
</policies>
```

## Pattern 7: Load Balancing with Retry

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

## Lab References (AI-Gateway Repo)

**Essential Labs to Get Started:**

| Scenario | Lab | Description |
|----------|-----|-------------|
| Semantic Caching | [semantic-caching](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/semantic-caching) | Cache similar prompts to reduce costs |
| Token Rate Limiting | [token-rate-limiting](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/token-rate-limiting) | Limit tokens per minute |
| Content Safety | [content-safety](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/content-safety) | Filter harmful content |
| Load Balancing | [backend-pool-load-balancing](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/backend-pool-load-balancing) | Distribute load across backends |
| MCP from API | [mcp-from-api](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/mcp-from-api) | Convert OpenAPI to MCP server |
| Zero to Production | [zero-to-production](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/zero-to-production) | Complete production setup guide |

**Find more labs at:** https://github.com/Azure-Samples/AI-Gateway/tree/main/labs

## Quick Start Checklist

### Prerequisites
- [ ] Azure subscription created
- [ ] Azure CLI installed and authenticated (`az login`)
- [ ] Resource group created for AI Gateway resources

### Deployment
- [ ] Deploy APIM with Basicv2 SKU
- [ ] Configure managed identity
- [ ] Add backend for Azure OpenAI or AI Foundry
- [ ] Apply policies (caching, rate limits, content safety)

### Verification
- [ ] Test API endpoint through gateway
- [ ] Verify token metrics in Application Insights
- [ ] Check rate limiting headers in response
- [ ] Validate content safety filtering

## Best Practices

| Practice | Description |
|----------|-------------|
| **Default to Basicv2** | Use Basicv2 SKU for cost/speed optimization |
| **Use managed identity** | Prefer managed identity over API keys for backend auth |
| **Enable token metrics** | Use `azure-openai-emit-token-metric` for cost tracking |
| **Semantic caching** | Cache similar prompts to reduce costs (60-80% savings possible) |
| **Rate limit by key** | Use subscription ID or IP for granular rate limiting |
| **Content safety** | Enable `shield-prompt` to detect jailbreak attempts |

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Slow APIM creation** | Deployment takes 30+ minutes | Use Basicv2 SKU instead of Premium |
| **Token limit exceeded** | 429 response | Increase `tokens-per-minute` or add load balancing |
| **Cache not working** | No cache hits | Lower `score-threshold` (e.g., 0.7) |
| **Content blocked** | False positives | Increase category thresholds |
| **Backend auth fails** | 401 from Azure OpenAI | Assign Cognitive Services User role to APIM managed identity |
| **Rate limit too strict** | Legitimate requests blocked | Increase `calls` or `renewal-period` |

## Additional Resources

- [Azure API Management Documentation](https://learn.microsoft.com/azure/api-management/)
- [AI Gateway Samples Repository](https://github.com/Azure-Samples/AI-Gateway)
- [APIM Policies Reference](https://learn.microsoft.com/azure/api-management/api-management-policies)
- [Azure OpenAI Integration](https://learn.microsoft.com/azure/api-management/azure-openai-api-from-specification)
