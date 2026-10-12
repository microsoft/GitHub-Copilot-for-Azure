# AKS Storage Optimization

Reduce AKS persistent-volume and disk cost without weakening durability or performance. Never delete, migrate, change tier/redundancy, or recreate a node pool without explicit approval.

This workflow provides detailed rightsizing for Azure Disk CSI volumes and snapshots. For Azure Files or Blob CSI volumes, first verify the Kubernetes-to-Azure mapping, then invoke `cost-optimization` when available for service-specific lifecycle, tier, and pricing analysis. Use `azure-storage` for non-cost configuration guidance.

## Collect Evidence

1. Bind the cluster and kube context. Prefer a fitting host-advertised Azure MCP AKS read. Use the following command only with approved shell access; use `kubectl` only when the bound context is available:

```bash
az aks show --name "<cluster-name>" --resource-group "<resource-group>" \
  --query "{id:id,nodeResourceGroup:nodeResourceGroup,location:location,workspace:addonProfiles.omsagent.config.logAnalyticsWorkspaceResourceID}" \
  -o json
```

2. Collect the Kubernetes storage graph:

```bash
kubectl get pvc,pv,storageclass --all-namespaces -o json
```

Map PVC -> PV -> StorageClass -> `spec.csi.volumeHandle`. Retain requested capacity, status, claim reference, provisioner, SKU, reclaim policy, access modes, and volume binding mode; distinguish Azure Disk, Files, and Blob CSI volumes.

3. Query Resource Graph for `microsoft.compute/disks` and `microsoft.compute/snapshots` when the resource is in the node resource group, its ID matches a PV volume handle, or its snapshot source is a mapped disk. Project ID, name, resource group, location, SKU, size, disk state, `managedBy`, creation time, snapshot source ID, provisioned IOPS/throughput, and tags. Compare exact case-insensitive resource IDs with PV volume handles. Classify each mapping as verified, ambiguous, broken, or unmapped. Only verified mappings may support cost attribution, deletion advice, tier/capacity changes, or savings estimates.

4. If `cost-analysis` is available in the host skill inventory, invoke it to retrieve billed `ActualCost` grouped by `ResourceId` for the exact mapped disks and snapshots at the smallest applicable scope. Correlate only exact mapped resource IDs. If the skill or required cost data is unavailable, continue with utilization and performance evidence, report attributable cost and monetary savings as unavailable rather than zero.

5. For active verified Azure Disk mappings, collect representative capacity, IOPS, throughput, latency, and throttling evidence using [storage metrics](storage-metrics.md). Missing or sparse history means utilization is unknown, not zero.

## Recommend in Order

| Priority | Evidence | Recommendation |
|---|---|---|
| Remove unused | Released, Available, or Failed PV or missing PVC; unattached, unreferenced disk; obsolete snapshot not required for recovery/compliance | Confirm owner, failure cause, backend state, backup, and recovery requirements before proposing deletion |
| Right-size capacity | Active Azure Disk PVC has representative usage plus growth/recovery headroom below a cheaper billable size | Managed disks cannot shrink; back up, create a smaller PVC, copy and validate, cut over, then remove the old volume |
| Right-size performance | Lower SKU or provisioned IOPS/throughput meets historical demand and latency/SLA needs | Migrate through a new StorageClass/PVC, or lower configurable Premium SSD v2/Ultra performance |
| Prevent recurrence | Disposable dynamic volumes use `Retain` or retained resources lack review | Use `Delete` only for future disposable volumes; preserve `Retain` for recovery/compliance |

Deleting a PVC/PV produces savings only when its reclaim flow or approved follow-up deletes the billable Azure resource. Do not recommend a tier or capacity change from allocation alone. Exclude active backups, shared disks, database/log volumes, and compliance-retained data until owners confirm recovery, latency, performance, access-mode, zone, and redundancy needs.

Classify every candidate as **recommend optimization**, **potentially unused**, **investigate further**, **insufficient evidence**, or **no change recommended**. A Failed PV can indicate a broken backend, failed provisioning, recovery issue, or stale metadata. An unattached disk or Released, Available, or Failed PV alone is not proof that the resource is unused; verify whether an exact mapped Azure resource exists, confirm all remaining Kubernetes and Azure references, and establish ownership, backup, recovery, and backend state before recommending cleanup.

## Output

Return applicable fields for each candidate: namespace/PVC/PV, exact mapped Azure resource name or ID, current size/SKU/reclaim behavior, utilization/performance evidence, attributable cost, proposed state, estimated savings, migration/rollback, downtime, risk, and confidence. Name both sides of every verified Kubernetes-to-Azure mapping in the same candidate row. Recommend deletion only for verified unused resources and rightsizing only when the required evidence is available. Otherwise, report insufficient telemetry without estimating savings. Even after verification, require separate explicit approval before deleting a PVC, PV, snapshot, or Azure storage resource.