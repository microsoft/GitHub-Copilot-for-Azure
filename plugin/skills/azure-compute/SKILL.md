---
name: azure-compute
description: "Azure VM and VMSS router for recommendations, pricing, autoscale, orchestration, and connectivity troubleshooting. WHEN: Azure VM, VMSS, scale set, recommend, compare, server, website, burstable, lightweight, VM family, workload, GPU, learning, simulation, dev/test, backend, autoscale, load balancer, Flexible orchestration, Uniform orchestration, cost estimate, connect, refused, Linux, black screen, reset password, reach VM, port 3389, NSG, troubleshoot."
license: MIT
metadata:
  author: Microsoft
  version: "2.0.1"
---

# Azure Compute Skill

Routes Azure VM requests to the appropriate workflow based on user intent.

## Routing

```text
User intent?
├─ Recommend / choose / compare / price a VM or VMSS
│  └─ Route to [VM Recommender](workflows/vm-recommender/vm-recommender.md)
│
├─ Can't connect / RDP / SSH / troubleshoot a VM
│  └─ Route to [VM Troubleshooter](workflows/vm-troubleshooter/vm-troubleshooter.md)
│
└─ Unclear
   └─ Ask: "Are you looking for a VM recommendation, or troubleshooting a connectivity issue?"
```

| Signal                                                                        | Workflow                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| "recommend VM", "which VM", "VM size", "VM pricing", "VMSS", "scale set"     | [VM Recommender](workflows/vm-recommender/vm-recommender.md)       |
| "can't connect", "RDP", "SSH", "NSG blocking", "reset password", "black screen" | [VM Troubleshooter](workflows/vm-troubleshooter/vm-troubleshooter.md) |

## Workflows

| Workflow              | Purpose                                                  | References                                                                   |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **VM Recommender**    | Recommend VM sizes, VMSS, pricing using public APIs/docs | [vm-families](references/vm-families.md), [retail-prices-api](references/retail-prices-api.md), [vmss-guide](references/vmss-guide.md) |
| **VM Troubleshooter** | Diagnose and resolve VM connectivity failures (RDP/SSH) | [cannot-connect-to-vm](workflows/vm-troubleshooter/references/cannot-connect-to-vm.md) |
