---
name: azure-local
description: "Azure Local guidance. WHEN: Azure Local, Azure Stack HCI, Arc resource bridge, custom location, Azure Local VM, Arc VM, AKS on Azure Local, AKS hybrid, SDN, Lifecycle Manager."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Local

## Quick Reference

Azure Local planning, deployment, operations, workloads, networking, updates, troubleshooting. References: [MCP/CLI](references/mcp-and-cli-tools.md), [docs-map](references/docs-map.md), [resource-types](references/resource-types.md), [safety-rules](references/safety-rules.md).

## When to Use This Skill

Use for Azure Local, Azure Stack HCI, Azure Local VMs, AKS on Azure Local, AKS hybrid, SDN, lifecycle updates, disconnected sites. Do not use for cloud VM or public AKS guidance.

## MCP Tools

Use `mcp_azure_mcp_extension_cli_generate`, `mcp_azure_mcp_monitor`, `mcp_azure_mcp_resourcehealth`, and `mcp_azure_mcp_documentation`; verify scope with [MCP/CLI](references/mcp-and-cli-tools.md).

## Workflow

1. Deploy: [Plan](workflows/plan-and-deploy/plan-and-deploy.md)
2. Operate/update: [Operate](workflows/operate-and-update/operate-and-update.md)
3. VMs, AKS, SQL, images, disks, networks: [Workloads](workflows/workload-management/workload-management.md)
4. SDN, NSG, gateway, security: [Network](workflows/networking-and-security/networking-and-security.md)
5. Failures: [Troubleshoot](workflows/troubleshooting/troubleshooting.md)

Read the matched workflow first. Start read-only. Ask before updates, deletes, reimages, network changes, VM power/delete operations, or Arc bridge/custom location changes.

## Error Handling

| Scenario | Remediation |
| --- | --- |
| Version unknown | Ask or fetch latest docs. |
| Risky change | Stop; follow [safety-rules](references/safety-rules.md). |
| No local access | Use Azure control-plane only. |
