# Metrics Collection and Reporting

## Step 6: Collect Utilization Metrics

Query Azure Monitor for utilization data (last 14 days):

```powershell
$startTime = (Get-Date).AddDays(-14).ToString("yyyy-MM-ddTHH:mm:ssZ")
$endTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
az monitor metrics list --resource "<RESOURCE_ID>" --metric "Percentage CPU" --interval PT1H --aggregation Average --start-time $startTime --end-time $endTime
az monitor metrics list --resource "<RESOURCE_ID>" --metric "CpuTime,Requests" --interval PT1H --aggregation Total --start-time $startTime --end-time $endTime
```

## Step 7: Generate Optimization Report

Create report at `output/costoptimizereport<YYYYMMDD_HHMMSS>.md`:

**Report Structure:**
- Executive Summary: Total monthly cost, top 3 cost drivers with Portal links
- Cost Breakdown: Top 10 resources by cost
- Free Tier Analysis: Resources within free tiers
- Orphaned Resources: From azqr - immediate savings opportunities
- Recommendations: Priority 1 (high impact, low risk), Priority 2 (medium), Priority 3 (long-term)
- Total Estimated Savings: Monthly and annual
- Implementation Commands: With approval warnings
- Validation Appendix: Data sources and files

**Portal Link Format:** `https://portal.azure.com/#@<TENANT_ID>/resource/subscriptions/<SUB>/resourceGroups/<RG>/providers/<PROVIDER>/<TYPE>/<NAME>/overview`

## Step 8: Save Audit Trail

Save cost query results to `output/cost-query-result<timestamp>.json`:

```json
{"timestamp": "<ISO_8601>", "subscription": "<SUB>", "resourceGroup": "<RG>", "queries": [{"queryType": "ActualCost", "timeframe": "MonthToDate", "query": {}, "response": {}}]}
```

## Step 9: Clean Up

```powershell
Remove-Item -Path "temp" -Recurse -Force -ErrorAction SilentlyContinue
```

## Output Summary

1. **Cost Report** (`output/costoptimizereport<timestamp>.md`) - Recommendations with actual data
2. **Query Results** (`output/cost-query-result<timestamp>.json`) - Audit trail
