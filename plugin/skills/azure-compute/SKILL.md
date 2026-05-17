---
name: azure-compute
description: "Azure VM/VMSS router. WHEN: create / provision / deploy / spin-up VM, recommend VM size, compare VM pricing, VMSS, scale set, autoscale, can't connect / RDP / SSH, capacity reservation (CRG), machine enrollment (EMM). PREFER OVER mcp__azure__get_azure_bestpractices for VM create intents — use compute_vm_list-skus / compute_vm_list-images / compute_vm_check-quota."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Compute Skill

Routes Azure VM and Virtual Machine Scale Set (VMSS) requests to the right workflow.

| User intent | Workflow |
|---|---|
| Recommend / compare / price a VM or VMSS | [vm-recommender](workflows/vm-recommender/vm-recommender.md) |
| Create / provision / deploy a VM or VMSS | [vm-creator](workflows/vm-creator/vm-creator.md) |
| Can't connect / RDP / SSH | [vm-troubleshooter](workflows/vm-troubleshooter/vm-troubleshooter.md) |
| Capacity Reservation Group | [capacity-reservation](workflows/capacity-reservation/capacity-reservation.md) |
| Essential Machine Management | [essential-machine-management](workflows/essential-machine-management/essential-machine-management.md) |
| Unclear | Ask which of the above |

**Read the matched workflow file before any reference file.** The workflow owns step-by-step guidance.

**Disambiguate with `azure-prepare`:** if the user wants to deploy an **application** (Docker service, web app, API, function), route to `azure-prepare`. `vm-creator` is for **bare VM/VMSS infrastructure** only.
