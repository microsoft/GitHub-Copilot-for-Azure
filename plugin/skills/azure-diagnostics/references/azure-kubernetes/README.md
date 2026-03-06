# Azure Kubernetes Service (AKS) Troubleshooting

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This document is the **official source** for debugging and troubleshooting Azure Kubernetes Service (AKS) production issues. Follow these instructions to diagnose and resolve common AKS problems systematically.

## Overview

AKS troubleshooting covers pod failures, node issues, networking problems, and cluster-level failures. This guide provides systematic diagnosis flows and remediation steps for the most common issues.

## Quick Diagnosis Flow

1. **Identify symptoms** - What's failing? (Pods, nodes, networking, services?)
2. **Check cluster health** - Is AKS control plane healthy?
3. **Review events and logs** - What do Kubernetes events show?
4. **Isolate the issue** - Pod-level, node-level, or cluster-level?
5. **Apply targeted fixes** - Use the appropriate troubleshooting section

## Troubleshooting Sections

### Pod Failures & Application Issues
- CrashLoopBackOff, ImagePullBackOff, Pending pods
- Readiness/liveness probe failures
- Resource constraints (CPU/memory limits)

### Node & Cluster Issues
- Node NotReady conditions
- Autoscaling failures
- Resource pressure and capacity planning
- Upgrade problems

### Networking Problems
- Service unreachable/connection refused
- DNS resolution failures
- Load balancer issues
- Ingress routing failures
- Network policy blocking

## References

- [Networking Troubleshooting](networking.md)
- [Node & Cluster Troubleshooting](node-issues.md)

## General Investigation — "What happened in my cluster?"

When a user asks a broad question like "what happened in my AKS cluster?" or "check my AKS status", follow this flow to surface recent activity and issues:

```
1. Cluster health     → az aks show -g <rg> -n <cluster> --query "provisioningState"
2. Recent events      → kubectl get events -A --sort-by='.lastTimestamp' | head -40
3. Node status        → kubectl get nodes -o wide
4. Unhealthy pods     → kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
5. Activity log       → az monitor activity-log list -g <rg> --max-events 20 -o table
```

| Customer Question | Maps To |
|-------------------|---------|
| "What happened in my AKS cluster?" | Events + Activity log + Node status |
| "Is my cluster healthy?" | Cluster provisioning state + Node conditions |
| "Why are my pods failing?" | Unhealthy pods → `kubectl describe pod` → see Pod Failures section |
| "My app is unreachable" | See [Networking Troubleshooting](networking.md) |
| "Nodes are having issues" | See [Node & Cluster Troubleshooting](node-issues.md) |

> 💡 **Tip:** For AI-powered diagnostics, use AppLens MCP with the cluster resource ID — it automatically detects common issues and provides remediation recommendations.

---

## Common Diagnostic Commands

```bash
# Cluster overview
kubectl get nodes -o wide
kubectl get pods -A -o wide
kubectl get events -A --sort-by='.lastTimestamp'

# Pod diagnostics
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous

# Node diagnostics
kubectl describe node <node-name>
kubectl get pods -n kube-system -o wide

# Networking diagnostics
kubectl get svc -A
kubectl get endpoints -A
kubectl get networkpolicy -A
```

## AKS-Specific Tools

### Azure CLI Diagnostics
```bash
# Check cluster status
az aks show -g <rg> -n <cluster> --query "provisioningState"

# Get cluster credentials
az aks get-credentials -g <rg> -n <cluster>

# View node pools
az aks nodepool list -g <rg> --cluster-name <cluster> -o table
```

### AppLens (MCP) for AKS
For AI-powered diagnostics:
```
mcp_azure_mcp_applens
  intent: "diagnose AKS cluster issues"
  command: "diagnose"
  parameters:
    resourceId: "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.ContainerService/managedClusters/<cluster>"
```

## Best Practices

1. **Start with kubectl get/describe** - Always check basic status first
2. **Check events** - `kubectl get events -A` reveals recent issues
3. **Use systematic isolation** - Pod → Node → Cluster → Network
4. **Document changes** - Note what you tried and what worked
5. **Escalate when needed** - For control plane issues, contact Azure support

## Related Skills

- **azure-diagnostics** - General Azure resource troubleshooting
- **azure-deploy** - Deployment and configuration issues
- **azure-observability** - Monitoring and logging setup
```