---
name: azure-local
description: >-
  Azure Local guidance. WHEN: Azure Local, Azure Stack HCI, Arc resource bridge, custom location, Azure Local VM, Arc VM, AKS on Azure Local, AKS hybrid, SDN, Lifecycle Manager. Exclude cloud VM/AKS guidance.
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Local

## Quick Reference

Best for Azure Local infrastructure and workloads. See [docs-map](references/docs-map.md), [mcp-and-cli-tools](references/mcp-and-cli-tools.md), [resource-types](references/resource-types.md), and [safety-rules](references/safety-rules.md).

## When to Use This Skill

Use for Azure Local, Azure Stack HCI, Azure Local VMs, AKS on Azure Local, AKS hybrid, SDN, lifecycle updates, disconnected sites, or troubleshooting. Do not use for cloud VM or public AKS guidance.

## MCP Tools

Use documentation, CLI generation, monitor/resource health, and Bicep schema where supported. Azure MCP has no dedicated Azure Local namespace.

## Workflow

- Deploy -> [Plan and Deploy](workflows/plan-and-deploy/plan-and-deploy.md)
- Operate/update -> [Operate and Update](workflows/operate-and-update/operate-and-update.md)
- VM, AKS, SQL, images, disks, networks -> [Workload Management](workflows/workload-management/workload-management.md)
- SDN, NSG, load balancer, gateway, security -> [Networking and Security](workflows/networking-and-security/networking-and-security.md)
- Failures -> [Troubleshooting](workflows/troubleshooting/troubleshooting.md)

Read the matched workflow first. Use [docs-map](references/docs-map.md). Start read-only. Ask before updates, deletes, reimages, network changes, VM power/delete operations, or Arc bridge/custom location changes.

## Error Handling

Ask for version when unclear. Stop for risky changes and follow [safety-rules](references/safety-rules.md). Prefer Azure Local docs over cloud guidance. Without local access, stay with Azure control-plane checks.
