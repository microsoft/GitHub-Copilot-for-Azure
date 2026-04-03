# AKS Cluster Autoscaler (CAS)

Enable and tune the Cluster Autoscaler to automatically scale down idle nodes.

## Check CAS Status

```bash
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "agentPoolProfiles[].{name:name, casEnabled:enableAutoScaling, min:minCount, max:maxCount, count:count}" \
  -o table

az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "autoScalerProfile" -o json
```

## Check Node Utilization (7 days)

First, discover available metric names for the cluster — metric names vary by configuration:

```bash
az monitor metrics list-definitions \
  --resource "<AKS_RESOURCE_ID>" \
  --query "[].name.value" -o tsv
```

Select the appropriate CPU utilization metric from the output (commonly `node_cpu_usage_percentage` or `cpuUsagePercentage`), then query it:

```bash
az monitor metrics list \
  --resource "<AKS_RESOURCE_ID>" \
  --metric "<METRIC_NAME_FROM_ABOVE>" \
  --interval PT1H --aggregation Average \
  --start-time "<YYYY-MM-DDTHH:mm:ssZ>" \
  --end-time "<YYYY-MM-DDTHH:mm:ssZ>"
```

## Enable CAS

```bash
# Cluster-level
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --enable-cluster-autoscaler \
  --min-count <MIN_NODES> --max-count <MAX_NODES>

# Specific node pool
az aks nodepool update \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --name "<NODEPOOL_NAME>" \
  --enable-cluster-autoscaler \
  --min-count <MIN_NODES> --max-count <MAX_NODES>
```

## Recommended min/max Defaults

| Scenario | min-count | max-count |
|----------|-----------|-----------|
| Dev/test | 1 | current_count |
| Production (web/API) | 2 | current_count * 3 |
| Production (batch) | 0 | current_count * 5 |

> Risk: Low. CAS only scales down when pods can be safely rescheduled. Set min-count >= 2 for production HA.

## Tune CAS Profile

Apply when CAS is already on but idle nodes persist:

```bash
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --cluster-autoscaler-profile \
    scale-down-delay-after-add=10m \
    scale-down-unneeded-time=10m \
    scale-down-utilization-threshold=0.5 \
    max-graceful-termination-sec=600 \
    skip-nodes-with-system-pods=false  # WARNING: can evict system pods — ensure system pods have PDBs
```

To roll back to CAS defaults:

```bash
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --cluster-autoscaler-profile ""
```

## Profile Comparison

| Profile | scale-down-delay-after-add | scale-down-unneeded-time | utilization-threshold | Best For |
|---------|----------------------------|--------------------------|----------------------|----------|
| Default | 10m | 10m | 0.5 | General workloads |
| Cost-Optimized | 5m | 5m | 0.5 | Cost-sensitive, non-critical |
| Conservative | 30m | 30m | 0.7 | Stateful / production |
| Aggressive | 2m | 2m | 0.4 | Dev/test, batch |

> Risk: High for aggressive tuning. Ensure PodDisruptionBudgets (PDBs) are set on critical workloads before tuning. Always confirm with user before applying.
>
> Check existing PDBs before tuning:
> ```bash
> kubectl get pdb --all-namespaces
> ```

## Cost Impact Estimate

- Count idle nodes (utilization < 20% for 7+ days)
- Multiply: idle nodes x VM hourly price (Azure Retail Prices API) x 720 hrs/month
