# Warning Events Workflow

## Step 4: Collect Kubernetes Warning Events by Namespace

### Collection

1. **Primary**: `kubectl`. **Fallback**: `az aks command invoke`. If both unavailable, mark `Not assessed`.
2. Enumerate namespaces: `kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' --context <kubeContext>`
3. Per namespace, retrieve Warning events:
   ```bash
   kubectl get events --namespace <ns> --field-selector type=Warning -o json --context <kubeContext>
   ```
4. **30-day coverage**: Supplement etcd events with Azure Monitor Logs (Container Insights):
   ```kql
   KubeEvents
   | where TimeGenerated > ago(30d)
   | where Reason in ("Unhealthy","BackOff","FailedScheduling","FailedMount","OOMKilling","FailedCreate")
   | summarize Count=sum(Count), FirstSeen=min(TimeGenerated), LastSeen=max(TimeGenerated)
     by Namespace, Name, Reason, Message, SourceComponent
   | order by Count desc
   ```
   If unavailable, note limitation and use etcd events only.
5. Merge and deduplicate by `(namespace, reason, message-pattern, workload)`, using widest time window.

### Event Processing

Extract per Warning: `reason`, `message`, `involvedObject.kind/.name`, `count`, `firstTimestamp`/`lastTimestamp`, `source.component`.

### Workload Correlation

Resolve each Pod to top-level workload owner chain: Pod → ReplicaSet → Deployment (or StatefulSet/DaemonSet/Job → CronJob).

```bash
kubectl get pod <pod> -n <ns> -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}' --context <kubeContext>
```

Record as `<Kind>/<Name>` (e.g., `Deployment/my-app`). For ReplicaSet owners, resolve one level further to Deployment.

### Remediation

Per deduplicated Warning, produce up to 5 remediation steps: specific, implementation-ready, sequenced from quick fix to architectural.

### Probe Failure Deep-Dive

For workloads with `Unhealthy` events meeting threshold (**≥10 occurrences** or **≥7 day span**):

1. Collect deployment spec (probe config), app logs (48h, tail 250), sidecar/proxy logs (48h, tail 150).
2. Build root-cause analysis per workload:
   - **Live Evidence**: Synthesize spec, probes, events, logs. Reference specific errors: timeouts, circuit-breaker, HTTP 502/503, dependency throttling, protocol-detection timeouts.
   - **Interpretation**: True crash vs. dependency latency vs. startup timing vs. rollout churn vs. probe misconfiguration. Steady-state vs. transient.
   - **Recommended Change**: Implementation-ready — health endpoint redesign, circuit-breaker tuning, startup probe introduction, rollout smoothing.
3. **Service mesh awareness**: When Linkerd/Istio detected, evaluate proxy initialization timing impact. Look for HTTP 502 during startup, proxy readiness failures, `connection refused`. Recommend mesh-specific mitigations (e.g., `config.linkerd.io/proxy-await=enabled`, startup probe budgets, proxy resource tuning).

Record extraction timestamp (UTC and local time).
