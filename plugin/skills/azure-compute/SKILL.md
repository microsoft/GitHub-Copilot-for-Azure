---
name: azure-compute
description: "Azure VM and VMSS router for recommendations, pricing, autoscale, orchestration, and connectivity troubleshooting. WHEN: Azure VM, VMSS, scale set, recommend, compare, server, website, burstable, lightweight, VM family, workload, GPU, learning, simulation, dev/test, backend, autoscale, load balancer, Flexible orchestration, Uniform orchestration, cost estimate, connect, refused, Linux, black screen, reset password, reach VM, port 3389, NSG, troubleshoot."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.2"
---

# Azure Compute Skill

Routes Azure VM requests to the appropriate sub-skill based on user intent.

## When to Use This Skill

Activate this skill when the user:
- Asks about Azure Virtual Machines (VMs) or VM Scale Sets (VMSS)
- Asks about choosing a VM, VM sizing, pricing, or cost estimates
- Needs a workload-based recommendation for scenarios like database, GPU, deep learning, HPC, web tier, or dev/test
- Mentions VM families, autoscale, load balancing, or Flexible versus Uniform orchestration
- Wants to troubleshoot Azure VM connectivity issues such as unreachable VMs, RDP/SSH failures, black screens, NSG/firewall issues, or credential resets
- Uses prompts like "Help me choose a VM"

## Routing

```text
User intent?
├─ Recommend / choose / compare / price a VM or VMSS
│  └─ Route to [VM Recommender](agents/vm-recommender.md)
│
├─ Can't connect / RDP / SSH / troubleshoot a VM
│  └─ Route to [VM Troubleshooter](agents/vm-troubleshooter.md)
│
└─ Unclear
   └─ Ask: "Are you looking for a VM recommendation, or troubleshooting a connectivity issue?"
```

| Signal                                                                        | Sub-Skill                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| "recommend VM", "which VM", "VM size", "VM pricing", "VMSS", "scale set"     | [VM Recommender](agents/vm-recommender.md)             |
| "can't connect", "RDP", "SSH", "NSG blocking", "reset password", "black screen" | [VM Troubleshooter](agents/vm-troubleshooter.md)       |

## Sub-Skills

| Sub-Skill          | Purpose                                                  | References                                                                   |
| ------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **VM Recommender** | Recommend VM sizes, VMSS, pricing using public APIs/docs | [vm-families](references/vm-families.md), [retail-prices-api](references/retail-prices-api.md), [vmss-guide](references/vmss-guide.md) |
| **VM Troubleshooter** | Diagnose and resolve VM connectivity failures (RDP/SSH) | [cannot-connect-to-vm](references/vm-troubleshooting/cannot-connect-to-vm.md) |
