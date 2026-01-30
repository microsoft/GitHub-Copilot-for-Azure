# AI Gateway Policies

XML policy configurations for common AI Gateway patterns.

## Semantic Caching

```xml
<inbound>
    <azure-openai-semantic-cache-lookup score-threshold="0.8" embeddings-backend-id="embeddings-backend" embeddings-backend-auth="system-assigned" />
    <set-backend-service backend-id="{backend-id}" />
</inbound>
<outbound>
    <azure-openai-semantic-cache-store duration="120" />
</outbound>
```

| Parameter | Range | Description |
|-----------|-------|-------------|
| `score-threshold` | 0.7-0.95 | Higher = stricter matching |
| `duration` | 60-3600 | Cache TTL in seconds |

## Token Rate Limiting

```xml
<inbound>
    <set-backend-service backend-id="{backend-id}" />
    <azure-openai-token-limit counter-key="@(context.Subscription.Id)" tokens-per-minute="500" estimate-prompt-tokens="false" />
</inbound>
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `counter-key` | Subscription.Id, Request.IpAddress | Grouping key |
| `tokens-per-minute` | 100-100000 | Token quota |

## Content Safety

```xml
<inbound>
    <set-backend-service backend-id="{backend-id}" />
    <llm-content-safety backend-id="content-safety-backend" shield-prompt="true">
        <categories output-type="EightSeverityLevels">
            <category name="Hate" threshold="4" />
            <category name="Sexual" threshold="4" />
            <category name="SelfHarm" threshold="4" />
            <category name="Violence" threshold="4" />
        </categories>
    </llm-content-safety>
</inbound>
```

| Parameter | Range | Description |
|-----------|-------|-------------|
| `threshold` | 0-7 | 0=safe, 7=severe |
| `shield-prompt` | true/false | Detect jailbreaks |

## Request Rate Limiting

```xml
<inbound>
    <rate-limit-by-key calls="10" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
</inbound>
```

## Managed Identity Authentication

```xml
<inbound>
    <authentication-managed-identity resource="https://cognitiveservices.azure.com" output-token-variable-name="managed-id-access-token" />
    <set-header name="Authorization" exists-action="override">
        <value>@("Bearer " + (string)context.Variables["managed-id-access-token"])</value>
    </set-header>
    <set-backend-service backend-id="{backend-id}" />
    <azure-openai-emit-token-metric namespace="openai">
        <dimension name="Subscription ID" value="@(context.Subscription.Id)" />
    </azure-openai-emit-token-metric>
</inbound>
```

## Load Balancing with Retry

```xml
<inbound>
    <set-backend-service backend-id="{backend-pool-id}" />
</inbound>
<backend>
    <retry count="2" interval="0" first-fast-retry="true" condition="@(context.Response.StatusCode == 429 || context.Response.StatusCode == 503)">
        <set-backend-service backend-id="{backend-pool-id}" />
        <forward-request buffer-request-body="true" />
    </retry>
</backend>
```
