# General AKS Investigation & Diagnostics

## "What happened in my cluster?"

When a user asks a broad question like "what happened in my AKS cluster?" or "check my AKS status", follow this systematic flow:

1. Cluster health
2. Recent events
3. Node status
4. Unhealthy pods
5. All pods overview
6. System pods health
7. Activity log

Prefer supplied sanitized evidence or bounded existing-tool reads, not a broad
sweep. The preserved **[`aks-baseline`](../../scripts/aks-baseline.sh)** script
requires inspection and separate explicit local-execution approval under
[execution boundaries](../../references/execution-boundaries.md). Its provisioning
metadata is not Resource Health or application health.

```bash
# bash
./scripts/aks-baseline.sh -g <rg> -n <cluster> [--namespace <ns>]
```

```powershell
# PowerShell
.\scripts\aks-baseline.ps1 -ResourceGroup <rg> -Cluster <cluster> [-Namespace <ns>]
```

After reviewing the digest, deep-dive into a specific pod with `kubectl describe` / `kubectl logs`.

---

## AKS CLI Tools

```bash
# Use only an already configured, confirmed kubectl context; never fetch kubeconfig.

# View node pools
az aks nodepool list -g <rg> --cluster-name <cluster> -o table
```

### AppLens (MCP) for AKS

Discover the host's actual AppLens operation and input schema, supported AKS
detectors, authorization and window limits before any bounded invocation.

> 💡 **Tip:** AppLens automatically detects common issues and provides remediation recommendations using the cluster resource ID.

---

## Best Practices

1. **Start with kubectl get/describe** - Always check basic status first
2. **Check events** - `kubectl get events -A` reveals recent issues
3. **Use systematic isolation** - Pod -> Node -> Cluster -> Network
4. **Document changes** - Note what you tried and what worked
5. **Escalate when needed** - For control plane issues, contact Azure support
