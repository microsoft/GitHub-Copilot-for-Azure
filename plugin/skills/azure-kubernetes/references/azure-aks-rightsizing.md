# AKS Pod Rightsizing

Identify pods requesting far more CPU/memory than they use and recommend reduced resource requests.

## Detection

```powershell
# Authenticate to cluster
az aks get-credentials --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>"

# List all pod requests/limits
kubectl get pods --all-namespaces -o custom-columns=\
"NAMESPACE:.metadata.namespace,NAME:.metadata.name,\
CPU_REQ:.spec.containers[0].resources.requests.cpu,\
MEM_REQ:.spec.containers[0].resources.requests.memory,\
CPU_LIM:.spec.containers[0].resources.limits.cpu,\
MEM_LIM:.spec.containers[0].resources.limits.memory"

# Live usage
kubectl top pods --all-namespaces --sort-by=cpu
```

## Historical Metrics (Azure Monitor — 14 days)

```powershell
$start = (Get-Date).AddDays(-14).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end   = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")

az monitor metrics list \
  --resource "<AKS_RESOURCE_ID>" \
  --metric "cpuUsagePercentage" \
  --interval PT1H --aggregation Average \
  --start-time $start --end-time $end
```

## Optimization Rules

| Condition | Recommendation | Risk |
|-----------|----------------|------|
| CPU request >5x P95 actual | Reduce to `P95 * 1.2` | Medium |
| Memory request >3x P95 actual | Reduce to `P95 * 1.2` | Medium |
| CPU request >2x P95 actual | Recommend rightsizing with 20% buffer | Low |
| No resource limits set | Add limits to prevent noisy-neighbor waste | Low |
| No VPA/HPA configured | Suggest enabling Vertical Pod Autoscaler | Low |

## YAML Patch Format

```yaml
# Rightsizing patch for <NAMESPACE>/<DEPLOYMENT_NAME>
# Current: CPU request=<CURRENT>, P95 actual=<ACTUAL>
# Recommended: CPU request=<NEW> (P95 * 1.2 buffer)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <DEPLOYMENT_NAME>
  namespace: <NAMESPACE>
spec:
  template:
    spec:
      containers:
      - name: <CONTAINER_NAME>
        resources:
          requests:
            cpu: "<NEW_CPU>"
            memory: "<NEW_MEM>"
          limits:
            cpu: "<NEW_CPU_LIMIT>"
            memory: "<NEW_MEM_LIMIT>"
```

> Risk: Medium-High. Always review patches before applying. Test in non-production first. Get explicit user confirmation before applying to production.
