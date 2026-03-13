---
name: troubleshooting
description: "Diagnose AKS cluster incidents using Azure CLI, kubectl, AppLens, and AKS-aware MCP tools. WHEN: AKS cluster down, kubectl cannot connect, pod pending, crashloop, image pull failure, node not ready, kube-system unhealthy, ingress issue, DNS issue, autoscaler issue, upgrade failure, AKS troubleshooting."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.3"
---

# AKS Troubleshooting

## Quick Reference

| Property | Value |
|----------|-------|
| Best for | Day-2 AKS diagnosis in GHCP CLI |
| Primary tools | `az`, `kubectl`, `mcp_azure_mcp_aks`, `mcp_aks_mcp_az_aks_operations`, `mcp_azure_mcp_monitor`, `mcp_azure_mcp_resourcehealth` |
| Default posture | Evidence first, read-only first, remediation second |
| Output | Scope, evidence, failure domain, root cause, confidence, next checks, safe remediation, escalation |

## When to Use This Skill

- AKS cluster create, update, start, stop, or upgrade failed
- `kubectl` cannot connect to the AKS API server
- Nodes are missing or `NotReady`
- `kube-system` is unhealthy
- Pods are stuck in `Pending`, `CrashLoopBackOff`, `OOMKilled`, or `ImagePullBackOff`
- Service, ingress, DNS, CNI, egress, or network policy traffic is failing
- Cluster autoscaler, HPA, or KEDA is not scaling as expected
- The user needs structured AKS triage with `az`, AppLens, and `kubectl`

## MCP Tools

| Tool | Use |
|------|-----|
| `mcp_azure_mcp_aks` | Preferred AKS-aware inspection and kubectl mediation when the client exposes it |
| `mcp_aks_mcp_az_aks_operations` | Cluster and node pool inspection or operations exposed through AKS MCP |
| `mcp_azure_mcp_monitor` | Logs and metrics correlation when telemetry is relevant |
| `mcp_azure_mcp_resourcehealth` | Health status of AKS and supporting Azure resources |
| `mcp_azure_mcp_applens` | AppLens-style diagnostics when surfaced in the client |

When AKS-aware MCP tools are available, prefer them over raw shell commands. If they are unavailable, fall back to safe `az` and `kubectl` reads.

## Goals

- Determine whether the issue is Azure-side, AKS platform-side, Kubernetes-side, or workload-specific.
- Gather concrete evidence before proposing a root cause.
- Classify the failure into a small number of repeatable branches.
- End with safe next steps and explicit escalation criteria.

## Required Inputs

Try to obtain:

- subscription or active Azure context
- resource group
- AKS cluster name
- symptom summary
- impacted namespace, workload, service, or ingress when known
- first observed time or recent change window
- whether the issue is cluster-wide, namespace-wide, app-specific, external-only, or internal-only

If the minimum cluster identifier is missing, ask for it before deeper troubleshooting.

## Workflow

1. Establish scope.
   Determine whether the issue is lifecycle failure, API access, node health, `kube-system`, workload runtime, connectivity, DNS, scaling, or general degradation.

2. Gather Azure-side evidence first.
   Use `az aks show`, resource health, recent Azure operations, node pool state, and AppLens or AKS-aware detectors when available.

3. Gather Kubernetes-side evidence second.
   Check cluster reachability, nodes, `kube-system`, events, and affected workloads before diving into deep application logs.

4. Follow the matching branch.
   Use the smallest symptom branch that fits the issue and avoid broad speculation.

5. Synthesize findings.
   State the observed symptoms, quote the strongest evidence, identify the likely failure domain, estimate confidence, and give safe next steps.

## Branch Rules

### Cluster lifecycle failure

- Start with `az aks show` and recent Azure operations.
- Look for provisioning errors, quota issues, subnet exhaustion, outbound connectivity failures, API server DNS or connectivity failures, and upgrade drain problems.
- If the cluster becomes reachable, inspect `kube-system` add-ons next.

### Cannot connect to AKS API

- Distinguish kubeconfig and auth issues from endpoint reachability or cluster state.
- Check cluster mode, API server access restrictions, private DNS or network path, and whether the cluster is stopped or degraded.

### Nodes missing or `NotReady`

- Inspect `kubectl get nodes -o wide`, node conditions, node pool state, and recent events.
- Look for pressure, CNI failures, kubelet or certificate issues, VMSS failures, or autoscaler drift.

### `kube-system` unhealthy

- Check CoreDNS, metrics-server, konnectivity-agent, coredns-autoscaler, CNI pods, ingress controller, and CSI drivers as relevant.
- Treat widespread `kube-system` issues as platform signals before blaming workloads.

### Workloads `Pending` or unschedulable

- Inspect pod events, node allocatable resources, taints, affinity, PVCs, and quotas.
- Look for insufficient CPU or memory, selector mismatch, toleration mismatch, unbound PVCs, or init failures.

### Workloads `CrashLoopBackOff` or startup failure

- Inspect current and previous logs, pod events, and deployment or statefulset configuration.
- Look for bad config, missing secrets, readiness or liveness failures, OOMKilled, permission issues, or dependency DNS failures.

### Connectivity, ingress, or DNS failure

- Use an inside-out path: pod, service, endpoints, ingress or load balancer, DNS, then network controls.
- Separate external-only failures from cluster-internal failures.

### Scaling or autoscaler issues

- Inspect node pool size, pending pods, autoscaler config, metrics availability, and quota or subnet constraints.

### Unknown or general degradation

- Run the compact triage set: Azure state, AppLens findings, nodes, `kube-system`, cluster events, and impacted namespace summary.

## Error Handling

| Error or blocker | Likely cause | Remediation |
|------------------|--------------|-------------|
| No cluster context | Cluster name, resource group, or subscription is missing | Ask for the minimum identifier needed to continue |
| MCP tools unavailable | AKS-aware MCP server is not exposed by the client | Fall back to safe `az` and `kubectl` diagnostics |
| `kubectl` access blocked | RBAC, API access restriction, or private endpoint path issue | Distinguish auth from network reachability and explain the blocker |
| Logs or metrics missing | Monitoring is disabled or the wrong workspace is being queried | Use events, node state, and workload descriptions instead |
| Too many simultaneous symptoms | More than one failure domain may be involved | Triage the broadest or highest-severity signal first |

## Guardrails

- Default to read-only diagnostics.
- Do not restart, delete, cordon, drain, scale, upgrade, or reconfigure resources unless the user explicitly asks for remediation.
- Do not assume the app is at fault before checking cluster and `kube-system` health.
- Do not assume AKS is at fault before checking workload events and configuration.
- Do not conclude root cause without quoting the evidence that supports it.
- Do not rely on sidecar reference files for core diagnostic behavior in GHCP CLI. Keep the operating guidance in this file.

## Safe Command Patterns

Start with commands like these:

```bash
az aks show -g <resource-group> -n <cluster-name>
az aks nodepool list -g <resource-group> --cluster-name <cluster-name>
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get events -A --sort-by=.lastTimestamp
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous
```

Treat these as potentially disruptive and avoid them unless the user explicitly asks for remediation:

- deleting or restarting pods
- cordon or drain operations
- scaling node pools or workloads
- cluster upgrades or addon reconfiguration
- DNS, NSG, route, or firewall changes

## Output Format

Return this structure:

1. Scope and impact
2. Key evidence
3. Likely failure domain
4. Most likely root cause
5. Confidence
6. Recommended next checks
7. Safe remediation options
8. Escalation criteria

## Iterative Improvement Notes

If this skill is being reviewed or improved, test it against realistic AKS incident prompts and score:

- invocation quality
- intake quality
- branch selection
- command choice
- evidence quality
- root-cause accuracy
- safety
- final summary quality

Add new misses as regression cases instead of expanding the instructions with broad prose.
