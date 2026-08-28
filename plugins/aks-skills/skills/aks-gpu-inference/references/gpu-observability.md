# GPU observability and model-load OOM

Bind telemetry to the affected cluster, namespace, pod, container, GPU, and
incident window. A Kubernetes OOM symptom alone does not prove GPU-memory
exhaustion. Keep this diagnosis to pod/model logs and DCGM evidence: exclude
CPU-memory limits, model-size calculations, and GPU SKU-sizing tables.

## Correlate the evidence

```bash
kubectl get pod -n <namespace> <pod> -o json
kubectl logs -n <namespace> <pod> -c <container> --previous --timestamps
kubectl get node <gpu-node> -o json
az aks nodepool show --subscription <subscription> -g <resource-group> \
  --cluster-name <cluster> -n <pool> --query gpuProfile -o json
```

For an observed managed profile (`managementMode: Managed`,
`driver: Install`), AKS exposes its managed DCGM exporter on port **19400** and
labels enabled nodes `kubernetes.azure.com/dcgm-exporter=enabled`. For an
unmanaged or unknown profile, inspect the installed exporter's declared port;
do not copy the managed port assumption.

Correlate the model-load timestamp and container termination with:

| Signal | Use |
|---|---|
| `DCGM_FI_DEV_FB_USED` | Frame-buffer memory consumed before failure |
| `DCGM_FI_DEV_FB_FREE` | Remaining frame-buffer memory before failure |
| `DCGM_FI_DEV_GPU_UTIL` | Kernel-active time; not an efficiency score |

If `FB_USED` rises while `FB_FREE` approaches exhaustion in the same GPU and
incident window, the evidence supports VRAM pressure. If historical telemetry
is absent, report GPU OOM as unconfirmed; do not substitute Kubernetes memory
limits or generic node OOM guidance.

When the user supplied evidence and prohibited commands, state that no reads
ran. Require explicit authorization before monitoring mutation, restart,
scaling, cordon/drain, or node-pool changes. Propose a target-bound telemetry
collection plan instead.

Sources:
[managed exporter port](https://learn.microsoft.com/azure/aks/aks-managed-gpu-nodes),
[GPU observability](https://learn.microsoft.com/azure/aks/best-practices-gpu-observability).
