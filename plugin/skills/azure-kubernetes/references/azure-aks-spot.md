# AKS Spot Node Pools

Recommend and create Spot VM node pools for batch, dev/test, or fault-tolerant workloads (60-90% cost reduction vs regular nodes).

## Check Existing Node Pools

```powershell
az aks nodepool list \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "[].{name:name, vmSize:vmSize, priority:scaleSetPriority, count:count, mode:mode}" \
  -o table
```

## Estimate Savings (Azure Retail Prices API)

```powershell
# Regular price
az rest --method get \
  --url "https://prices.azure.com/api/retail/prices?\$filter=armSkuName eq '<VM_SIZE>' and armRegionName eq '<REGION>' and priceType eq 'Consumption'" \
  --query "Items[0].retailPrice"

# Spot price
az rest --method get \
  --url "https://prices.azure.com/api/retail/prices?\$filter=armSkuName eq '<VM_SIZE>' and armRegionName eq '<REGION>' and priceType eq 'Consumption' and skuName contains 'Spot'" \
  --query "Items[0].retailPrice"
```

## Create Spot Node Pool

```powershell
az aks nodepool add \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --name "<SPOT_POOL_NAME>" \
  --priority Spot \
  --eviction-policy Delete \
  --spot-max-price -1 \
  --node-vm-size "<VM_SIZE>" \
  --node-count 1 --min-count 0 --max-count <MAX_NODES> \
  --enable-cluster-autoscaler \
  --node-taints "kubernetes.azure.com/scalesetpriority=spot:NoSchedule" \
  --labels "kubernetes.azure.com/scalesetpriority=spot"
```

## Workload Toleration (add to Deployment YAML)

```yaml
tolerations:
- key: "kubernetes.azure.com/scalesetpriority"
  operator: "Equal"
  value: "spot"
  effect: "NoSchedule"
nodeSelector:
  kubernetes.azure.com/scalesetpriority: spot
```

## Suitability

| Workload | Spot-Suitable? |
|----------|----------------|
| Batch / data processing | Yes |
| Dev / test environments | Yes |
| Stateless web/API (replicas >= 2) | Yes (with care) |
| Jobs with checkpointing | Yes |
| Stateful workloads (databases) | No |
| Single-replica critical services | No |

> Risk: Low for batch/dev. High for production stateful workloads. Spot VMs evict with 30-second notice. Eviction policy Delete is recommended for AKS.
