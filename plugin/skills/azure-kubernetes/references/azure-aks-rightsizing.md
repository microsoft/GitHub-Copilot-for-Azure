# AKS Pod Rightsizing

Identify pods requesting far more CPU/memory than they use and recommend reduced resource requests.

## Prerequisites — Check Monitoring State First

Before collecting usage data, determine what monitoring is available on the cluster:

```bash
# 1. Check if Azure Managed Prometheus is enabled
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "azureMonitorProfile.metrics.enabled" -o tsv

# 2. Check if Container Insights (Log Analytics) is enabled
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "addonProfiles.omsagent.enabled" -o tsv

# 3. Check if Metrics Server is running (pre-installed on AKS, but may be unhealthy)
kubectl get deployment metrics-server -n kube-system
```

Based on the result, follow the appropriate path:

| State | Rightsizing Possible? | Data Source | Accuracy |
|-------|-----------------------|-------------|----------|
| Azure Managed Prometheus enabled |  Yes | Prometheus metrics via Azure Monitor | Best — full P95/7-day history |
| Container Insights (Log Analytics) enabled |  Yes | KQL queries on `Perf` / `KubePodInventory` | Good — 7-day trends |
| Only Metrics Server (no Azure Monitor) |  Limited | `kubectl top pods` — live data only | Low — no historical trends |
| Nothing enabled (Azure Monitor) |  Limited | Metrics Server pre-installed on AKS — use `kubectl top` for live data | Low — no historical trends |

> If nothing is enabled, Metrics Server is pre-installed on AKS — confirm it is healthy and use it for live rightsizing data:
> ```bash
> kubectl get deployment metrics-server -n kube-system
> kubectl top pods --all-namespaces --sort-by=cpu
> ```
> For historical P95 trends (more accurate rightsizing), recommend enabling Azure Managed Prometheus. Warn user this incurs cost and wait for confirmation before proceeding.

---

## Detection

```bash
# Authenticate to cluster
az aks get-credentials --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>"

# List all pod requests/limits
kubectl get pods --all-namespaces \
  -o custom-columns="NAMESPACE:.metadata.namespace,NAME:.metadata.name,\
CPU_REQ:.spec.containers[0].resources.requests.cpu,\
MEM_REQ:.spec.containers[0].resources.requests.memory,\
CPU_LIM:.spec.containers[0].resources.limits.cpu,\
MEM_LIM:.spec.containers[0].resources.limits.memory"

# Live usage
kubectl top pods --all-namespaces --sort-by=cpu
```

## Historical Metrics (Azure Monitor — use when Prometheus or Container Insights is enabled)

```bash
az monitor metrics list \
  --resource "<AKS_RESOURCE_ID>" \
  --metric "cpuUsagePercentage" \
  --interval PT1H --aggregation Average \
  --start-time "<YYYY-MM-DDTHH:mm:ssZ>" \
  --end-time "<YYYY-MM-DDTHH:mm:ssZ>"
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

## Vertical Pod Autoscaler (VPA)

Use VPA when the user wants automatic, ongoing rightsizing rather than a one-time patch.

### Prerequisites

```bash
# Check if VPA is installed
kubectl get crd verticalpodautoscalers.autoscaling.k8s.io 2>/dev/null && echo "VPA installed" || echo "VPA not installed"
```

If not installed, install via Helm (AKS does not ship VPA by default):

```bash
helm repo add fairwinds-stable https://charts.fairwinds.com/stable
helm install vpa fairwinds-stable/vpa --namespace kube-system
```

### Enable VPA in Recommendation-Only Mode (safe starting point)

Recommendation-only mode (`Off`) reads usage and provides suggestions without changing pod specs.

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: <DEPLOYMENT_NAME>-vpa
  namespace: <NAMESPACE>
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: <DEPLOYMENT_NAME>
  updatePolicy:
    updateMode: "Off"   # recommendation-only — no automatic restarts
  resourcePolicy:
    containerPolicies:
    - containerName: "*"
      minAllowed:
        cpu: 50m
        memory: 64Mi
      maxAllowed:
        cpu: "4"
        memory: 8Gi
```

```bash
# Dry-run first to validate the manifest
kubectl apply -f vpa-<DEPLOYMENT_NAME>.yaml --dry-run=client

# Apply VPA object
kubectl apply -f vpa-<DEPLOYMENT_NAME>.yaml

# Read VPA recommendations (wait a few minutes after applying)
kubectl get vpa <DEPLOYMENT_NAME>-vpa -n <NAMESPACE> -o json \
  | python3 -c "
import json, sys
v = json.load(sys.stdin)
recs = v['status']['recommendation']['containerRecommendations']
for r in recs:
    print(r['containerName'], 'target:', r['target'])
"
```

### VPA Update Modes

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `Off` | Recommendations only, no changes | **Start here** — safe for all clusters |
| `Initial` | Sets requests only on new pods | Low-risk; no restarts of running pods |
| `Auto` | Evicts and restarts pods to apply recommendations | Only after validating `Off` mode recommendations |

> Risk: `Off` mode is zero-risk. `Auto` mode causes pod restarts — confirm with user and ensure PodDisruptionBudgets are set before switching.

### Apply VPA Recommendations as a One-Time Patch

If the user prefers a single manual rightsizing instead of ongoing VPA automation:

```bash
# Extract target values from VPA recommendation
TARGET_CPU=$(kubectl get vpa <DEPLOYMENT_NAME>-vpa -n <NAMESPACE> \
  -o jsonpath='{.status.recommendation.containerRecommendations[0].target.cpu}')
TARGET_MEM=$(kubectl get vpa <DEPLOYMENT_NAME>-vpa -n <NAMESPACE> \
  -o jsonpath='{.status.recommendation.containerRecommendations[0].target.memory}')

# Dry-run patch to preview changes
kubectl patch deployment <DEPLOYMENT_NAME> -n <NAMESPACE> \
  --patch "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"<CONTAINER_NAME>\",\"resources\":{\"requests\":{\"cpu\":\"$TARGET_CPU\",\"memory\":\"$TARGET_MEM\"}}}]}}}}" \
  --dry-run=client

# Apply after user confirms
kubectl patch deployment <DEPLOYMENT_NAME> -n <NAMESPACE> \
  --patch "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"<CONTAINER_NAME>\",\"resources\":{\"requests\":{\"cpu\":\"$TARGET_CPU\",\"memory\":\"$TARGET_MEM\"}}}]}}}}"
```
