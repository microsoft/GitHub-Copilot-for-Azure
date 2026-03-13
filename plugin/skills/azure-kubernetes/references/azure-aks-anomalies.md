# AKS Cost Anomaly Investigation

Investigate user-reported cost or utilization spikes by correlating Azure Monitor metrics, scaling events, and Cost Management data.

## Step 1 - Confirm Timeframe

Ask the user: "When did you notice the spike? (e.g., 'last Tuesday', 'between 2 AM and 4 AM yesterday')"

## Step 2 - Pull Cost Data

```powershell
az rest --method post \
  --url "https://management.azure.com/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
  --body '{
    "type": "ActualCost",
    "timeframe": "Custom",
    "timePeriod": { "from": "<START>", "to": "<END>" },
    "dataset": {
      "granularity": "Daily",
      "aggregation": { "totalCost": { "name": "Cost", "function": "Sum" } },
      "grouping": [{ "type": "Dimension", "name": "ResourceId" }]
    }
  }'
```

## Step 3 - Pull Node Count and Scaling Events

```powershell
# Node count over the anomaly window
az monitor metrics list \
  --resource "<AKS_RESOURCE_ID>" \
  --metric "kube_node_status_condition" \
  --interval PT5M --aggregation Count \
  --start-time "<START>" --end-time "<END>"

# HPA scaling events
kubectl get events --all-namespaces \
  --field-selector reason=SuccessfulRescale \
  --sort-by='.lastTimestamp'
```

## Step 4 - Top Consumers

```powershell
kubectl top nodes
kubectl top pods --all-namespaces --sort-by=cpu | head -20
```

## Common Causes

| Symptom | Likely Cause | Action |
|---------|-------------|--------|
| Node count surged off-peak | HPA/VPA misconfiguration | Review HPA min replicas |
| Single pod consuming all CPU | Memory leak or runaway process | Check logs, add resource limits |
| Cost spike on specific day | Batch job ran unexpectedly | Review CronJob schedule |
| Persistent high node count | CAS scale-down blocked | Check PodDisruptionBudgets, system pods |
| Sudden namespace cost jump | New deployment with no resource limits | Add requests/limits |

## Set Up Budget Alert

```powershell
az consumption budget create \
  --budget-name "aks-monthly-budget" \
  --amount <BUDGET_AMOUNT> \
  --time-grain Monthly \
  --start-date "<YYYY-MM-01>" \
  --end-date "<YYYY-MM-01>" \
  --resource-group "<RESOURCE_GROUP>" \
  --threshold 80 \
  --contact-emails "<EMAIL>"
```
