---
name: aks-gpu-inference
description: "Diagnose Day-2 AKS GPU and KAITO incidents using profile-aware, read-only evidence. WHEN: 'Insufficient nvidia.com/gpu', GPU pod Pending, model-load OOM, DCGM/VRAM, KAITO Workspace not ready, or GPU autoscaling. DO NOT USE FOR: setup (airunway-aks-setup), non-GPU incidents (aks-troubleshooting), standalone VM quota (azure-quotas), or generic cost (azure-cost)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# AKS GPU Inference Day-2

## Quick Reference

| Property | Value |
|---|---|
| Best for | AKS GPU/KAITO failures |
| Evidence | Bound target, events/status, `gpuProfile`, DCGM |

## When to Use This Skill

Use for scheduling, VRAM/OOM, KAITO readiness, and workload scaling. Route
exclusions as described above.

## MCP Tools

Use a fitting host-advertised Azure read or the references' read-only queries.

## Workflow

1. Bind subscription, cluster, kube context, pool, and affected resource.
2. Capture exact events/status and observed `gpuProfile`; state which reads ran.
3. Route to [scheduling](references/gpu-scheduling.md),
   [observability](references/gpu-observability.md),
   [KAITO](references/kaito-workspaces.md), or
   [scaling](references/gpu-cost-and-scaling.md).
4. For Managed+Install OOM, require port 19400 and incident-window
   `FB_USED`/`FB_FREE`; do not substitute CPU-memory or SKU-sizing advice.
5. For KAITO not-ready, warn that Workspace deletion leaves its GPU pools;
   cleanup is separate and needs explicit authorization.
6. Report evidence, confidence, missing evidence, and owner handoff.

Require explicit authorization before scaling, cordon/drain, deletion,
add-on enablement, or monitoring mutation.

## Error Handling

| Condition | Response |
|---|---|
| Missing/contradictory evidence | Mark unconfirmed; request the owner/read |
| Unknown profile | Preserve evidence; do not prescribe stack repair |
| Mutation required | Propose separately and wait for authorization |
