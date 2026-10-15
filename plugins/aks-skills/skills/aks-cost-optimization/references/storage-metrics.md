# AKS Storage Capacity and Performance Evidence

Use this workflow only for active, verified Azure Disk mappings. Reuse
representative results already collected for the same cluster and period.

## Capacity History

With Container Insights, query all PVs over about 30 days:

```kusto
let pv = KubePVInventory
| where TimeGenerated >= ago(30d) and ClusterId =~ "<aks-resource-id>"
| summarize arg_max(TimeGenerated, *) by PVCNamespace, PVCName, PVName
| project PVCNamespace, PVCName, PVName, PVCapacityBytes;
let usage = InsightsMetrics
| where TimeGenerated >= ago(30d)
| where Namespace == "container.azm.ms/pv" and Name == "pvUsedBytes"
| extend t=todynamic(Tags)
| where tostring(t.clusterId) =~ "<aks-resource-id>"
| extend PVCNamespace=tostring(t.pvcNamespace), PVCName=tostring(t.pvcName)
| summarize p95UsedBytes=percentile(Val, 95), maxUsedBytes=max(Val),
    samples=count(), firstSample=min(TimeGenerated),
    lastSample=max(TimeGenerated) by PVCNamespace, PVCName;
pv
| join kind=leftouter usage on PVCNamespace, PVCName
| extend p95UsedPct=round(100.0*p95UsedBytes/PVCapacityBytes, 1),
    sampleSpanDays=datetime_diff("day", lastSample, firstSample)
```

Cross-check with live inventory. Retain sample count and first/last timestamps.
Account for growth, batch cycles, backups, recovery, and operational headroom.
`azureblob-*` volumes do not expose this metric. Missing or sparse samples mean
unknown utilization, not zero.

## Disk Performance

Discover the Azure Monitor metric definitions exposed by each mapped disk, then
batch equivalent metrics where supported. Collect representative average, p95
when available, and maximum values for:

- read and write operations per second;
- read and write bytes per second;
- latency and throttling or consumed-performance percentage.

Compare historical demand with the candidate disk's capacity, IOPS, throughput,
burst behavior, and the attached VM or node aggregate disk limits. A lower tier
is eligible only when it preserves workload latency, durability, zone,
redundancy, and recovery requirements. Do not recommend a tier from allocation
or capacity usage alone.
