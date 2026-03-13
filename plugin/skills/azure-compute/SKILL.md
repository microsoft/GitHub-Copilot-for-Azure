---
name: azure-compute
description: "Azure VM and VMSS skill router for recommendation, pricing, sizing, and connectivity troubleshooting. WHEN: recommend VM size, which VM should I use, choose Azure VM, machine learning VM, memory-intensive workload, burstable VM, lightweight web app, cheapest Azure VM for website, VM pricing, cost estimate, VM families, VMSS, scale set, flexible orchestration, uniform orchestration, can't connect to VM, unreachable VM, RDP not working, SSH refused, SSH into Azure Linux VM, VM black screen, NSG rules blocking traffic, reset VM password, VM connectivity, troubleshoot my VM, can't reach my VM."
license: MIT
metadata:
  author: Microsoft
  version: "2.0.0"
---

# Azure Compute Skill

Routes Azure VM requests to the appropriate sub-skill based on user intent.

## When to Use This Skill

- User asks about Azure VMs, VM sizing, VMSS, or VM connectivity

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
