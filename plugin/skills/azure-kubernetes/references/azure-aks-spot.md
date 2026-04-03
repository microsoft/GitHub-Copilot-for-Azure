# AKS Spot Node Pools

Recommend and create Spot VM node pools for batch, dev/test, or fault-tolerant workloads (60-90% cost reduction vs regular nodes).

## Check Existing Node Pools

```bash
az aks nodepool list \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "[].{name:name, vmSize:vmSize, priority:scaleSetPriority, count:count, mode:mode}" \
  -o table
```

## Identify Spot-Suitable Workloads

Before creating a Spot pool, identify which workloads can tolerate interruptions:

```bash
# List deployments without PodDisruptionBudgets (single-replica or no PDB = higher eviction risk)
kubectl get deployments --all-namespaces -o json | \
  jq -r '.items[] | select(.spec.replicas == 1) | "\(.metadata.namespace)/\(.metadata.name)"'

# Check which pods already have spot tolerations
kubectl get pods --all-namespaces -o json | \
  jq -r '.items[] | select(.spec.tolerations[]?.key == "kubernetes.azure.com/scalesetpriority") | "\(.metadata.namespace)/\(.metadata.name)"'
```

Use the suitability table below to decide which workloads to migrate.

## Estimate Savings (Azure Retail Prices API)

The Retail Prices API is **unauthenticated** — use `curl` or `Invoke-RestMethod` directly. `az rest` adds an unnecessary Azure login requirement. Use `meterName` to distinguish Spot from regular and `isPrimaryMeterRegion eq true` to avoid duplicate meters.

```bash
# Regular price (Linux, Pay-as-you-go)
curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName%20eq%20'Virtual%20Machines'%20and%20armSkuName%20eq%20'<VM_SIZE>'%20and%20armRegionName%20eq%20'<REGION>'%20and%20priceType%20eq%20'Consumption'%20and%20isPrimaryMeterRegion%20eq%20true"

# Spot price (Linux) — filter meterName directly in OData
curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName%20eq%20'Virtual%20Machines'%20and%20armSkuName%20eq%20'<VM_SIZE>'%20and%20armRegionName%20eq%20'<REGION>'%20and%20priceType%20eq%20'Consumption'%20and%20isPrimaryMeterRegion%20eq%20true%20and%20contains(meterName%2C%20'Spot')"
```

```powershell
$filter = "serviceName eq 'Virtual Machines' and armSkuName eq '<VM_SIZE>' and armRegionName eq '<REGION>' and priceType eq 'Consumption' and isPrimaryMeterRegion eq true"
$r = Invoke-RestMethod "https://prices.azure.com/api/retail/prices?`$filter=$filter"

# Regular Linux price
$r.Items | Where-Object { $_.meterName -notmatch "Spot" -and $_.productName -notmatch "Windows" } | Select-Object -First 1 -ExpandProperty retailPrice

# Spot Linux price
$r.Items | Where-Object { $_.meterName -match "Spot" -and $_.productName -notmatch "Windows" } | Select-Object -First 1 -ExpandProperty retailPrice
```

> If `Items` is empty, verify the SKU name with `az vm list-skus --location <REGION> --output table`. If `NextPageLink` is present in the response, re-request that URL to paginate.

## Mixed Node Pool Pattern (Spot + Regular)

For workloads that need resilience but want cost savings, use a mixed approach:

```bash
# Keep existing regular node pool as fallback (min 1-2 nodes)
az aks nodepool update \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --name "<REGULAR_POOL>" \
  --enable-cluster-autoscaler --min-count 1 --max-count 3

# Add Spot pool for the majority of workload capacity
az aks nodepool add \
  --cluster-name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --name "<SPOT_POOL_NAME>" \
  --priority Spot --eviction-policy Delete --spot-max-price -1 \
  --node-vm-size "<VM_SIZE>" \
  --node-count 3 --min-count 0 --max-count 10 \
  --enable-cluster-autoscaler \
  --node-taints "kubernetes.azure.com/scalesetpriority=spot:NoSchedule" \
  --labels "kubernetes.azure.com/scalesetpriority=spot"
```

Workloads without spot tolerations automatically fall back to the regular pool on eviction.

## Create Spot Node Pool

```bash
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

## Handling Eviction Gracefully

Configure workloads to handle the 30-second eviction notice:

```yaml
# Add to Deployment spec — terminationGracePeriodSeconds should be < 30s for Spot
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 25
      containers:
      - name: <CONTAINER_NAME>
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5"]  # Drain in-flight requests
```

Set a PodDisruptionBudget to limit simultaneous evictions:

```bash
kubectl apply -f - <<EOF
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: <APP_NAME>-pdb
  namespace: <NAMESPACE>
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: <APP_NAME>
EOF
```
