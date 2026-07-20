---
name: azure-compute
description: "Azure VM/VMSS creation, recommendation, pricing, and troubleshooting router. WHEN: create/provision a bare VM; generate VM Bicep/Terraform/az CLI; validate SKU/image/quota; choose a VM for a web server or workload; create a scale set/autoscaling web tier/compute fleet/agent pool/self-hosted or ephemeral CI runner; fix RDP/SSH; manage Capacity Reservation Groups (CRGs); or check/enable EMM machine enrollment. Prefer for bare compute; use azure-prepare for applications."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Compute Skill

Routes Azure VM and Virtual Machine Scale Set (VMSS) requests to the right workflow.

## When to Use This Skill

- User wants to **recommend, compare, or price** a VM or VMSS
- User wants to **create, provision, or deploy** a VM or VMSS
- User wants a bare-compute **web tier, agent pool, runner pool, or build fleet**
- User **can't connect** to a VM (RDP / SSH / port refused / black screen / password reset)
- User asks about **Capacity Reservation Groups** (CRG) — reserve, guarantee capacity, pre-provision
- User asks about **Essential Machine Management** (EMM) — machine enrollment, monitor

**Disambiguate with `azure-prepare`:** if the user wants to deploy an **application** (Docker service, web app, API, serverless workload), route to `azure-prepare`. `vm-creator` is for **bare VM/VMSS infrastructure** only.

## Routing

**Mandatory workflow-first routing:** never route directly to `references/*` files. First classify the user intent below, open the matched workflow file, then load only the reference files that workflow requests. Reference files are supporting material, not entry points. If the intent is unclear, ask a clarifying question to disambiguate between the workflows.

| Workflow | File | Use when |
|---|---|---|
| **VM Recommender** | [vm-recommender.md](workflows/vm-recommender/vm-recommender.md) | User asks which VM/VMSS to choose, whether to use VMSS/autoscaling, wants pricing, or wants to compare options |
| **VM Creator** | [vm-creator.md](workflows/vm-creator/vm-creator.md) | User wants to create, provision, or deploy a bare VM or VMSS (not an app deployment) |
| **VM Troubleshooter** | [vm-troubleshooter.md](workflows/vm-troubleshooter/vm-troubleshooter.md) | User can't connect, RDP/SSH refused, black screen, needs password reset |
| **Capacity Reservation** | [capacity-reservation.md](workflows/capacity-reservation/capacity-reservation.md) | User needs to reserve / guarantee VM capacity (CRG create / associate / disassociate) |
| **Essential Machine Management** | [essential-machine-management.md](workflows/essential-machine-management/essential-machine-management.md) | User asks about EMM / machine enrollment / monitor |
