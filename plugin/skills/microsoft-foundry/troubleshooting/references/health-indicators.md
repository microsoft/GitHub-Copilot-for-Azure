# Deployment Health Indicators

This reference documents the key metrics and thresholds for monitoring deployment health in Microsoft Foundry.

## Key Metrics

| Metric | Description | Source |
|--------|-------------|--------|
| **Latency** | Response time for API calls | Azure Monitor |
| **SuccessfulCalls** | Count of successful requests | Azure Monitor |
| **BlockedCalls** | Requests blocked by content filter | Azure Monitor |
| **ServerErrors** | 5xx error responses | Azure Monitor |
| **ClientErrors** | 4xx error responses | Azure Monitor |
| **TokensProcessed** | Total tokens consumed | Azure Monitor |
| **ProvisioningState** | Deployment status | Resource API |

## Health Thresholds

### Latency (P95)

| Status | Threshold | Interpretation |
|--------|-----------|----------------|
| 🟢 Healthy | < 500ms | Normal performance |
| 🟡 Degraded | 500ms - 2s | Performance issues |
| 🔴 Critical | > 2s or timeout | Major issues |

### Error Rate

| Status | Threshold | Interpretation |
|--------|-----------|----------------|
| 🟢 Healthy | < 1% | Normal operation |
| 🟡 Degraded | 1% - 5% | Investigate |
| 🔴 Critical | > 5% | Immediate action |

### Availability

| Status | Threshold | Interpretation |
|--------|-----------|----------------|
| 🟢 Healthy | > 99.9% | Meeting SLA |
| 🟡 Degraded | 99% - 99.9% | Below target |
| 🔴 Critical | < 99% | Outage impact |

## Azure Monitor Queries

### Get Deployment Metrics
```bash
az monitor metrics list \
  --resource <resource-id> \
  --metric "Latency" "SuccessfulCalls" "ServerErrors" \
  --interval PT5M \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --output table
```

### Calculate Error Rate (Log Analytics)
```kusto
AzureDiagnostics
| where ResourceType == "COGNITIVESERVICES"
| where TimeGenerated > ago(1h)
| summarize
    Total = count(),
    Errors = countif(ResultType != "Success")
| extend ErrorRate = round(100.0 * Errors / Total, 2)
```

### Latency Distribution
```kusto
AzureDiagnostics
| where ResourceType == "COGNITIVESERVICES"
| where TimeGenerated > ago(1h)
| summarize
    P50 = percentile(DurationMs, 50),
    P95 = percentile(DurationMs, 95),
    P99 = percentile(DurationMs, 99)
```

### Identify Error Patterns
```kusto
AzureDiagnostics
| where ResourceType == "COGNITIVESERVICES"
| where ResultType != "Success"
| where TimeGenerated > ago(24h)
| summarize Count = count() by ResultType, bin(TimeGenerated, 1h)
| render timechart
```

## Setting Up Alerts

### High Error Rate Alert
```bash
az monitor metrics alert create \
  --name "HighErrorRate" \
  --resource-group <resource-group> \
  --scopes <resource-id> \
  --condition "avg ServerErrors > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id>
```

### High Latency Alert
```bash
az monitor metrics alert create \
  --name "HighLatency" \
  --resource-group <resource-group> \
  --scopes <resource-id> \
  --condition "avg Latency > 2000" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id>
```

## Dashboard Metrics

For Azure Dashboard, include these tiles:

| Tile | Metric | Aggregation | Time Range |
|------|--------|-------------|------------|
| Request Volume | SuccessfulCalls | Sum | Last hour |
| Error Rate | ServerErrors / Total | Percentage | Last hour |
| P95 Latency | Latency | P95 | Last hour |
| Blocked Calls | BlockedCalls | Sum | Last hour |
| Token Usage | TokensProcessed | Sum | Last day |

## Interpreting Metrics

### High ServerErrors
- **Possible causes:** Service-side issues, capacity problems
- **Actions:** Check Azure status, verify deployment state, retry

### High Latency
- **Possible causes:** Large requests, capacity constraints, network issues
- **Actions:** Reduce request size, scale deployment, check region

### High BlockedCalls
- **Possible causes:** Content filter triggers, policy violations
- **Actions:** Review content policies, adjust filtering settings

### Zero SuccessfulCalls
- **Possible causes:** Deployment down, authentication issues, network problems
- **Actions:** Check deployment state, verify credentials, test connectivity

## Proactive Monitoring

**Daily checks:**
- Review error rate trends
- Check latency percentiles
- Verify provisioning state = Succeeded

**Weekly checks:**
- Analyze capacity utilization
- Review blocked call patterns
- Update alert thresholds if needed

**Monthly checks:**
- Review SLA compliance
- Analyze cost vs. performance
- Plan capacity adjustments
