# Rate Limiting Best Practices

## Capacity Planning

1. **Monitor baseline** - Track TPM/RPM over time
2. **Plan for growth** - Request 20-30% more quota than current need
3. **Test at scale** - Load test before production launch
4. **Set up alerts** - Alert at 70-80% quota usage

**Sample alert (infrastructure setup):**

Use Azure CLI for one-time infrastructure configuration:
```bash
az monitor metrics alert create \
  --name "High-Rate-Limit-Errors" \
  --resource <foundry-resource-id> \
  --condition "count HttpErrors where ResultType == 429 > 10" \
  --window-size 5m --evaluation-frequency 1m
```

## Request Optimization

**Token Usage:**
- Monitor token consumption per request
- Truncate input to stay within limits (1 token ≈ 4 characters)
- Use shorter system prompts when possible

**Batch Processing:**
- Process requests in batches (e.g., 10 at a time)
- Add brief pauses between batches (1-2 seconds)
- Spread load over time rather than bursts

## Monitoring Strategy

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
