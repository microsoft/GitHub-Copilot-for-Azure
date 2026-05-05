---
name: azure-local
description: "Plan, deploy, operate, update, secure, and troubleshoot Azure Local. WHEN: Azure Local, Azure Stack HCI, Arc resource bridge, custom location, Azure Local VM, Arc VM, AKS on Azure Local, AKS hybrid, SDN, Lifecycle Manager, disconnected site. DO NOT USE FOR: standard public Azure VM or AKS guidance."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Local

Use for Azure Local infrastructure and workloads: deployment, operations, lifecycle updates, Arc resource bridge, custom locations, Azure Local VMs, AKS hybrid, SDN, security, and troubleshooting.

## Routing

| Signal | Workflow |
| --- | --- |
| Deploy, prerequisites, topology, Arc gateway, portal/ARM deployment | [Plan and Deploy](workflows/plan-and-deploy/plan-and-deploy.md) |
| Operate, inventory, monitor, update, lifecycle | [Operate and Update](workflows/operate-and-update/operate-and-update.md) |
| Azure Local VM, Arc VM, AKS hybrid, SQL, images, disks, networks | [Workload Management](workflows/workload-management/workload-management.md) |
| SDN, NSG, load balancer, gateway, private endpoint, security | [Networking and Security](workflows/networking-and-security/networking-and-security.md) |
| Deployment, Arc bridge, custom location, VM, AKS, SDN, update failure | [Troubleshooting](workflows/troubleshooting/troubleshooting.md) |

## Rules

1. Read the matched workflow first.
2. Treat Microsoft Learn as authoritative; use [docs-map](references/docs-map.md).
3. Start read-only. Ask before updates, deletes, reimages, network changes, VM power/delete operations, or Arc bridge/custom location changes.
4. Use Azure MCP/ARG for inventory; use CLI/PowerShell only where documented.
5. Keep public Azure VM/AKS guidance separate.

## References

- [MCP and CLI tools](references/mcp-and-cli-tools.md)
- [Safety rules](references/safety-rules.md)
- [Resource types](references/resource-types.md)
