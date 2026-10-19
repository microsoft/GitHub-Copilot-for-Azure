# AKS Storage Capacity and Performance Evidence

Use this workflow only for active, verified Azure Disk mappings. Reuse
representative results already collected for the same cluster and period.

## Capacity History

Check the cluster's managed Prometheus workspace first. Use a fitting
host-advertised Azure Monitor read or the approved Prometheus query API. Query
the requested period, up to 30 days, with:

```promql
max by (namespace, persistentvolumeclaim) (
  kubelet_volume_stats_capacity_bytes
)

max by (namespace, persistentvolumeclaim) (
  quantile_over_time(0.95, kubelet_volume_stats_used_bytes[30d])
)

max by (namespace, persistentvolumeclaim) (
  max_over_time(kubelet_volume_stats_used_bytes[30d])
)
```

Use a range query to retain sample count and first/last timestamps. Join by
namespace and PVC, then cross-check the result with live inventory and the
verified PVC/PV/disk mapping. Prometheus identifies volumes only by namespace
and PVC name. Use samples from the current PVC/PV binding only; if its start
cannot be verified, treat the history as ambiguous.

If managed Prometheus history is unavailable, and Container Insights populates
`KubePVInventory` and `InsightsMetrics`, query:

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
| extend PVCNamespace=tostring(t.pvcNamespace), PVCName=tostring(t.pvcName),
    PVName=tostring(t.pvName)
| summarize p95UsedBytes=percentile(Val, 95), maxUsedBytes=max(Val),
    samples=count(), firstSample=min(TimeGenerated),
    lastSample=max(TimeGenerated) by PVCNamespace, PVCName, PVName;
pv
| join kind=leftouter usage on PVCNamespace, PVCName, PVName
| extend p95UsedPct=round(100.0*p95UsedBytes/PVCapacityBytes, 1),
    sampleSpanDays=datetime_diff("day", lastSample, firstSample)
```

Do not fall back to joining on PVC namespace/name when the usage-side PV name
is missing; treat that history as ambiguous.

For either source, report the requested and actual observed periods. Workspace
retention limits the lookback. Account for growth, batch cycles, backups, recovery, and
operational headroom. `azureblob-*` volumes do not expose this metric. Missing
or sparse samples mean unknown utilization, not zero.

## Disk Performance

Discover the Azure Monitor metric definitions exposed by each mapped disk.
Query supported disk-resource metrics for read/write operations and bytes.

For latency and consumed IOPS/bandwidth percentage, map the exact disk resource
ID to each VMSS instance where it was attached and obtain its LUN from that
instance's data-disk configuration. Query the VM instance's Data Disk Latency,
Data Disk IOPS Consumed Percentage, and Data Disk Bandwidth Consumed Percentage
metrics for that LUN.

Build time-aligned disk/instance/LUN attachment intervals across the lookback
because a disk can move between nodes. Combine only verified intervals; if
historical attachment timing is unavailable, report incomplete performance
history rather than attributing another disk's LUN metrics. For each source,
collect representative average, p95 when available, and maximum values.

Compare historical demand with the candidate disk's capacity, IOPS, throughput,
burst behavior, and the attached VM or node aggregate disk limits. A lower tier
is eligible only when it preserves workload latency, durability, zone,
redundancy, and recovery requirements. Do not recommend a tier from allocation
or capacity usage alone.
