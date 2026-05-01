# AKS Cost Optimization Report
**Cluster**: <CLUSTER_NAME> | **Resource Group**: <RESOURCE_GROUP>
**Location**: <LOCATION> | **Nodes**: <NODE_COUNT> x <VM_SIZE> | **Tier**: <TIER>
**Generated**: <TIMESTAMP>
**AKS Cost Analysis Add-on**: <ENABLED|DISABLED>

═══════════════════════════════════════════════════════════════════

## EXECUTIVE SUMMARY
- Current Monthly Node Cost: $<TOTAL_MONTHLY> (<NODE_COUNT> x $<NODE_PRICE>/mo)
- Scenarios Analyzed: 7
- **Total Potential Savings: $<TOTAL_SAVINGS>/month ($<TOTAL_ANNUAL>/year)**

| Scenario                  | Finding                              | Savings/Month | Priority        |
|---------------------------|--------------------------------------|---------------|-----------------|
| Overprovisioned Pods      | <N> pods, <WASTE_PCT>% CPU wasted    | $<S1>         | HIGH/MEDIUM/LOW |
| Missing Requests/Limits   | <N> pods with no requests set        | $<S2>         | HIGH/MEDIUM/LOW |
| Idle Workloads            | <N> deployments near-zero usage      | $<S3>         | HIGH/MEDIUM/LOW |
| Namespace Cost Allocation | Top namespace: <NS> at $<COST>/mo    | N/A (insight) | INFO            |
| Node Pool Rightsizing     | Avg node utilization: <PCT>%         | $<S5>         | HIGH/MEDIUM/LOW |
| Cluster Autoscaler        | <ENABLED|DISABLED>                   | $<S6>         | HIGH/MEDIUM/LOW |
| Spot Node Pool            | <N> eligible workloads               | $<S7>         | HIGH/MEDIUM/LOW |


═══════════════════════════════════════════════════════════════════

## SCENARIO 1 — Overprovisioned Pods

> Skip this section if no overprovisioned pods found.

| Pod | Container | CPU Req | CPU Actual | Overprov | Mem Req | Mem Actual | Namespace |
|-----|-----------|---------|------------|----------|---------|------------|-----------|
| <POD> | <CTR> | <REQ> | <ACT> | <N>x | <MEM_REQ> | <MEM_ACT> | <NS> |

**Recommended fix per deployment:**
```bash
kubectl set resources deployment/<NAME> -n <NS> \
  --requests=cpu=<R_REQ>,memory=<M_REQ> \
  --limits=cpu=<R_LIM>,memory=<M_LIM>
```

**Node impact**: <CURRENT_NODES> -> <TARGET_NODES> nodes | Saves **$<SAVINGS>/month**

Rightsizing guidelines:
- Actual CPU 0-5m    -> request 10-25m,    limit 100-200m
- Actual CPU 5-50m   -> request actual x2,  limit actual x10
- Actual CPU 50m+    -> request actual x1.5, limit actual x3
- Actual Mem <10Mi   -> request 32-64Mi,    limit 128-256Mi
- Actual Mem 10Mi+   -> request actual x2,  limit actual x4

---

## SCENARIO 2 — Missing Requests/Limits

> Skip this section if all pods have requests and limits set.

Pods without resource requests prevent the scheduler from bin-packing nodes efficiently,
leading to under-utilized nodes and unnecessary scale-out.

| Pod | Namespace | Missing |
|-----|-----------|---------|
| <POD> | <NS> | requests / limits / both |

```bash
# Find all pods missing requests
kubectl get pods --all-namespaces -o json
# Check .spec.containers[].resources.requests — empty means no requests set
```

**Impact**: Nodes may scale out unnecessarily. Setting requests enables proper bin-packing.

---

## SCENARIO 3 — Idle Workloads

> Skip this section if no idle workloads found.

Deployments running pods with near-zero CPU and memory usage for an extended period.
Candidates for scale-down to 0 replicas during off-hours, or permanent deletion.

| Deployment | Namespace | Replicas | CPU Actual | Mem Actual | Suggestion |
|------------|-----------|----------|------------|------------|------------|
| <DEPLOY> | <NS> | <N> | <CPU> | <MEM> | Scale to 0 / Delete |

```bash
# Scale idle deployment to 0 replicas
kubectl scale deployment/<NAME> -n <NS> --replicas=0

# Delete if no longer needed
kubectl delete deployment/<NAME> -n <NS>
```

---

## SCENARIO 4 — Namespace Cost Allocation

> Requires AKS Cost Analysis add-on. See Prerequisites section if disabled.

Shows which namespaces and workloads drive the most cost based on proportional
node resource usage.

| Namespace | CPU Share | Mem Share | Est. Monthly Cost |
|-----------|-----------|-----------|-------------------|
| <NS> | <PCT>% | <PCT>% | $<COST> |

View in Azure Portal:
```
https://portal.azure.com/#@<TENANT_ID>/resource/subscriptions/<SUB_ID>/resourceGroups/<RG>/providers/Microsoft.ContainerService/managedClusters/<CLUSTER>/costAnalysis
```

---

## SCENARIO 5 — Node Pool Rightsizing

> Skip this section if average node CPU/memory utilization is above 50%.

If nodes are consistently underutilized, consider switching to a smaller VM SKU.

| Node Pool | VM SKU | vCPU | RAM | Avg CPU Util | Avg Mem Util | Suggested SKU |
|-----------|--------|------|-----|-------------|-------------|---------------|
| <POOL> | <SKU> | <N> | <N>GiB | <PCT>% | <PCT>% | <NEW_SKU> |

```bash
# Add new node pool with smaller SKU, then cordon and drain old pool
az aks nodepool add \
  --cluster-name <CLUSTER> --resource-group <RG> \
  --name <NEW_POOL> --node-vm-size <NEW_SKU> --node-count <N>

kubectl cordon <OLD_NODE>
kubectl drain <OLD_NODE> --ignore-daemonsets --delete-emptydir-data

az aks nodepool delete \
  --cluster-name <CLUSTER> --resource-group <RG> --name <OLD_POOL>
```

**Savings**: $<OLD_PRICE>/mo -> $<NEW_PRICE>/mo per node = **$<SAVINGS>/month**

---

## SCENARIO 6 — Cluster Autoscaler

> Skip this section if cluster autoscaler is already enabled.

Without autoscaler, the cluster runs a fixed node count regardless of actual workload.
Enabling it allows AKS to scale down idle nodes automatically.

**Current state**: Fixed at <NODE_COUNT> nodes ($<MONTHLY>/month)

```bash
az aks nodepool update \
  --cluster-name <CLUSTER> --resource-group <RG> \
  --name agentpool \
  --enable-cluster-autoscaler \
  --min-count <MIN> \
  --max-count <MAX>
```

**Estimated savings**: Up to $<SAVINGS>/month during low-traffic periods.

---

## SCENARIO 7 — Spot Node Pool Opportunity

> Skip this section if no eligible workloads identified.

Spot VMs offer up to 90% discount but can be evicted with 30s notice.
Suitable for: batch jobs, dev/test workloads, stateless tolerant services.

| Workload | Namespace | Spot-Eligible | Reason |
|----------|-----------|---------------|--------|
| <DEPLOY> | <NS> | Yes/No | <REASON> |

```bash
az aks nodepool add \
  --cluster-name <CLUSTER> --resource-group <RG> \
  --name spotnodepool \
  --priority Spot \
  --eviction-policy Delete \
  --spot-max-price -1 \
  --node-vm-size <VM_SKU> \
  --node-count <N>
```

Add toleration to eligible workloads:
```yaml
tolerations:
- key: "kubernetes.azure.com/scalesetpriority"
  operator: "Equal"
  value: "spot"
  effect: "NoSchedule"
```

**Savings**: Spot discount ~<PCT>% vs pay-as-you-go = **$<SAVINGS>/month**

---

## PREREQUISITES / REMEDIATION

### AKS Cost Analysis Add-on

Required for Scenario 4 (Namespace Cost Allocation). Requires Standard or Premium tier.

```bash
# Check current status
az aks show --name <CLUSTER> --resource-group <RG> \
  --query "metricsProfile.costAnalysis.enabled"

# Check tier (must be Standard or Premium)
az aks show --name <CLUSTER> --resource-group <RG> --query "sku.tier"

# Upgrade tier if needed (Free -> Standard)
az aks update --name <CLUSTER> --resource-group <RG> --tier standard

# Enable cost analysis add-on
az aks update --name <CLUSTER> --resource-group <RG> --enable-cost-analysis
```

═══════════════════════════════════════════════════════════════════

## TOTAL SAVINGS SUMMARY

| Scenario                | Monthly Savings | Annual Savings | Effort |
|-------------------------|----------------|----------------|--------|
| 1. Overprovisioned Pods | $<S1>          | $<S1A>         | Low    |
| 2. Missing Requests     | $<S2>          | $<S2A>         | Low    |
| 3. Idle Workloads       | $<S3>          | $<S3A>         | Low    |
| 5. Node Pool Rightsize  | $<S5>          | $<S5A>         | Medium |
| 6. Cluster Autoscaler   | $<S6>          | $<S6A>         | Low    |
| 7. Spot Node Pool       | $<S7>          | $<S7A>         | Medium |
| **TOTAL**               | **$<TOTAL>**   | **$<TOTAL_A>** |        |

═══════════════════════════════════════════════════════════════════

## DATA SOURCES
- Actual pod usage: `kubectl top pods --all-namespaces`
- Pod requests/limits: `kubectl get pods --all-namespaces -o json`
- Node pricing: Azure Retail Pricing API (Consumption, <REGION>, <VM_SIZE> Linux)
- Namespace costs: AKS Cost Analysis add-on (Azure Portal)
