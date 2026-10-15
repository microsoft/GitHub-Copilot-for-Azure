---
name: aks-cost-optimization
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
description: "Analyze advanced AKS cost efficiency using NAP readiness, node-pool bin packing, scaling bottlenecks, and Kubernetes-to-Azure storage mapping. WHEN: \"assess AKS NAP readiness\", \"AKS bin packing\", \"AKS node scaling bottleneck\", \"AKS blocked scale-down\", \"AKS storage cost\", \"optimize AKS disks\". DO NOT USE AS DIRECT ENTRY FOR: rightsizing/VPA/CAS/Spot (azure-kubernetes); spend/anomalies/commitments (cost-analysis and cost-optimization); incidents (aks-troubleshooting)."
---

# AKS Cost Optimization

## Quick Reference

| Property | Value |
|---|---|
| Best for | NAP readiness, bin-packing, node-scaling bottlenecks, AKS storage |
| Output | Evidence-backed recommendation, estimated cost impact when available, risk, confidence, and required handoff |

## When to Use This Skill

Use when optimizing costs for an existing AKS cluster requires Kubernetes
scheduling or placement evidence, node-pool modeling, or verified
PVC/PV-to-Azure resource mapping that billing data alone cannot provide. Route
common cluster configuration to `azure-kubernetes`, billed spend and anomalies
to `cost-analysis`, and commitments to `cost-optimization`.

## MCP Tools

Prefer fitting host-advertised Azure MCP reads. Never invent tool names, route
`kubectl` through MCP, or use `az`/`kubectl` without approved shell access.

## Workflow/Steps

1. Bind the subscription, cluster, resource group, and kube context.
2. Route to [NAP readiness](references/aks-nap.md),
   [bin-packing](references/aks-bin-packing.md), or
   [storage optimization](references/aks-storage-optimization.md).
3. For post-optimization commitment analysis, use the
   [commitment-demand handoff](references/aks-savings-plans-reservations.md)
   before invoking `cost-optimization`. When invoked by `cost-optimization` for
   AKS commitment context, collect and return the same demand evidence without
   performing benefit analysis or a transaction.
4. Keep reads non-mutating; require approval for every change.

## Error Handling

| Error | Action |
|---|---|
| Missing capability | Analyze supplied evidence or give a collection plan. |
| `cost-analysis` unavailable | Continue with utilization and configuration evidence; mark billed cost and monetary savings unavailable. |
| `cost-optimization` unavailable | Return AKS demand evidence; mark commitment analysis, purchase, and renewal unavailable. |
| Evidence conflict | Mark the conclusion unconfirmed. |
