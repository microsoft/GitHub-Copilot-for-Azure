---
name: azure-local
description: "Plan, deploy, operate, and troubleshoot Azure Local (formerly Azure Stack HCI): sizing and prerequisites, Arc registration, lifecycle updates, workloads (Azure Local VMs, AKS on Azure Local, images, disks, logical networks), SDN and network security, and failure triage — starting read-only and confirming before risky changes. WHEN: Azure Local, Azure Stack HCI, Arc resource bridge, custom location, Azure Local VM, Arc VM, AKS on Azure Local, AKS hybrid, SDN, Lifecycle Manager, Azure Local update, disconnected site."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Local

## Quick Reference

| Property | Value |
| --- | --- |
| Best for | Azure Local planning, deployment, operations, workloads |
| MCP Tools | Generic Azure MCP tools only; no Azure Local namespace |
| CLI | `az graph query`, `az resource show`, Azure Local PowerShell modules |
| Key references | [docs-map](references/docs-map.md), [mcp-and-cli-tools](references/mcp-and-cli-tools.md), [resource-types](references/resource-types.md), [safety-rules](references/safety-rules.md) |
| Related skills | azure-compute (public VMs), azure-kubernetes (public AKS) |

## When to Use This Skill

Use for Azure Local, Azure Stack HCI, Azure Local VMs, AKS on Azure Local, AKS hybrid, SDN, lifecycle updates, disconnected sites, or troubleshooting. Do not use for cloud VM or public AKS guidance.

## MCP Tools

Azure Local has no dedicated MCP namespace; use generic Azure MCP tools.

| Tool | Purpose | Azure Local limitation |
| --- | --- | --- |
| `mcp_azure_mcp_extension_cli_generate` | ARG/CLI commands for inventory | Verify output against Azure Local docs |
| `mcp_azure_mcp_monitor` | Logs and metrics | Needs Log Analytics configured |
| `mcp_azure_mcp_resourcehealth` | Control-plane health | Partial; not local cluster health |
| `mcp_azure_mcp_documentation` | Microsoft Learn content | Pass the user's version when known |

Details: [mcp-and-cli-tools](references/mcp-and-cli-tools.md).

## Workflow

1. Deploy -> [plan-and-deploy](workflows/plan-and-deploy/plan-and-deploy.md)
2. Operate/update -> [operate-and-update](workflows/operate-and-update/operate-and-update.md)
3. VMs, AKS, images, disks, networks -> [workload-management](workflows/workload-management/workload-management.md)
4. SDN, NSG, load balancer, gateway -> [networking-and-security](workflows/networking-and-security/networking-and-security.md)
5. Failures -> [troubleshooting](workflows/troubleshooting/troubleshooting.md)

Read the matched workflow first and use [docs-map](references/docs-map.md). Start read-only. Ask before updates, deletes, reimages, network changes, VM power/delete operations, or Arc bridge/custom location changes.

## Error Handling

| Scenario | Remediation |
| --- | --- |
| Version unknown | Ask for the Azure Local version, or use latest docs. |
| Risky change detected | Stop and follow [safety-rules](references/safety-rules.md). |
| No local access | Stay with Azure control-plane checks only. |
| Doc URL 404/redirect | Search Learn for the article title with the user's version. |
