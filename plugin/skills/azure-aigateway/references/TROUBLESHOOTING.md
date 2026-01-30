# Troubleshooting & Best Practices

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

## Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Slow APIM creation** | Deployment takes 30+ minutes | Use Basicv2 SKU instead of Premium |
| **Token limit exceeded** | 429 response | Increase `tokens-per-minute` or add load balancing |
| **Cache not working** | No cache hits | Lower `score-threshold` (e.g., 0.7) |
| **Content blocked** | False positives | Increase category thresholds |
| **Backend auth fails** | 401 from Azure OpenAI | Assign Cognitive Services User role to APIM managed identity |
| **Rate limit too strict** | Legitimate requests blocked | Increase `calls` or `renewal-period` |

## Lab References (AI-Gateway Repo)

| Scenario | Lab | Description |
|----------|-----|-------------|
| Semantic Caching | [semantic-caching](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/semantic-caching) | Cache similar prompts |
| Token Rate Limiting | [token-rate-limiting](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/token-rate-limiting) | Limit tokens per minute |
| Content Safety | [content-safety](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/content-safety) | Filter harmful content |
| Load Balancing | [backend-pool-load-balancing](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/backend-pool-load-balancing) | Distribute load |
| MCP from API | [mcp-from-api](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/mcp-from-api) | Convert OpenAPI to MCP |
| Zero to Production | [zero-to-production](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/zero-to-production) | Complete setup guide |

**More labs:** https://github.com/Azure-Samples/AI-Gateway/tree/main/labs

## Additional Resources

- [Azure API Management Documentation](https://learn.microsoft.com/azure/api-management/)
- [AI Gateway Samples Repository](https://github.com/Azure-Samples/AI-Gateway)
- [APIM Policies Reference](https://learn.microsoft.com/azure/api-management/api-management-policies)
- [Azure OpenAI Integration](https://learn.microsoft.com/azure/api-management/azure-openai-api-from-specification)
