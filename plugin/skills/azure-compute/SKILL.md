---
name: azure-compute
description: >-
  Azure compute skill that routes to specialized sub-skills for VM and VMSS guidance.
  USE FOR: recommend VM size, which VM should I use, choose Azure VM, VM for web/database/ML/batch/HPC,
  GPU VM, compare VM sizes, cheapest VM, best VM for workload, VM pricing, cost estimate,
  burstable/compute/memory/storage optimized VM, confidential computing, VM trade-offs, VM families,
  VMSS, scale set recommendation, autoscale VMs, load balanced VMs, VMSS vs VM, scale out,
  horizontal scaling, flexible orchestration.
  DO NOT USE FOR: deploying VMs or VMSS (use azure-deploy), managing existing VMs
  (use azure-resource-lookup), cost optimization of running VMs (use azure-cost-optimization),
  non-VM services like App Service or AKS.
---

# Azure Compute Skill

This skill helps developers with Azure compute resources, covering VM size recommendations, VM Scale Sets, and compute configuration guidance.

## Sub-Skills

> **MANDATORY: Before executing ANY workflow, you MUST read the corresponding sub-skill document.** Do not proceed with a workflow without reading its skill document first. This applies even if you already know the general approach — the sub-skill document contains required workflow steps, pre-checks, and validation logic that must be followed.

This skill includes specialized sub-skills for specific workflows. **Use these instead of the main skill when they match your task:**

| Sub-Skill       | When to Use                                                                    | Reference                                    |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| **recommender** | Recommend VM sizes, VMSS configurations, compare VM families, estimate pricing | [recommender/SKILL.md](recommender/SKILL.md) |

## Intent Routing

Analyze the user's prompt and route to the correct sub-skill:

```
User Prompt
    │
    ├─ Recommend / choose / compare VMs or VMSS
    │  "which VM should I use", "recommend a VM size",
    │  "compare VM families", "cheapest VM for my workload",
    │  "should I use VM or VMSS", "autoscale recommendation"
    │  └─> RECOMMENDER sub-skill
    │
    └─ (Future sub-skills will be added here)
```

## When to Use This Skill

- User asks which Azure VM or VMSS to choose for a workload
- User needs VM size recommendations for web, database, ML, batch, HPC, or other workloads
- User wants to compare VM families, sizes, or pricing tiers
- User asks about trade-offs between VM options (cost vs performance)
- User needs a cost estimate for Azure VMs without an Azure account
- User asks whether to use a single VM or a scale set
- User needs autoscaling, high availability, or load-balanced VM recommendations
- User asks about VMSS orchestration modes (Flexible vs Uniform)

## Error Handling

| Scenario            | Action                                                          |
| ------------------- | --------------------------------------------------------------- |
| User intent unclear | Ask clarifying questions; default to recommender sub-skill      |
| Sub-skill not found | Fall back to recommender sub-skill for general compute guidance |
