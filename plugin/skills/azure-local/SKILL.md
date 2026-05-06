---
name: azure-local
description: "Azure Local guidance. WHEN: Azure Local, Azure Stack HCI, Arc resource bridge, custom location, Azure Local VM, Arc VM, AKS on Azure Local, AKS hybrid, SDN, Lifecycle Manager. Exclude cloud VM/AKS guidance."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Local

## Quick Reference

| Property | Value |
| --- | --- |
| Best for | Azure Local infrastructure planning, deployment, operations, and workload management |
| MCP Tools | Generic Azure MCP tools only; no dedicated Azure Local namespace |
| CLI | `az graph query`, `az resource show`, Azure Local PowerShell modules |
| Key references | [docs-map](references/docs-map.md), [mcp-and-cli-tools](references/mcp-and-cli-tools.md), [resource-types](references/resource-types.md), [safety-rules](references/safety-rules.md) |
| Related skills | azure-compute (public VMs), azure-kubernetes (public AKS) |

## When to Use This Skill

Use this skill for Azure Local, Azure Stack HCI, Azure Local VMs, AKS on Azure Local, AKS hybrid, SDN, lifecycle updates, disconnected sites, or troubleshooting. Do not use for cloud VM or public AKS guidance.

## MCP Tools

| Tool | Purpose | Key Parameters | Azure Local scope note |
| --- | --- | --- | --- |
| `mcp_azure_mcp_extension_cli_generate` | Generate ARG or CLI commands for inventory | subscription, resource type, query goal | Verify generated commands against Azure Local docs and resource types |
| `mcp_azure_mcp_monitor` | Query logs or metrics when Log Analytics is configured | workspace/resource ID, query, time range | Returns data only where Azure Monitor or Log Analytics is configured |
| `mcp_azure_mcp_resourcehealth` | Check Azure control-plane health signals | resource ID, subscription | Use only where Azure Resource Health supports the resource type; do not treat missing data as local cluster health |
| `mcp_azure_mcp_documentation` | Fetch current Microsoft Learn content | article title, Azure Local version when known | Use the user's Azure Local version when provided; otherwise fetch latest docs |

## Workflow

1. Deploy -> [Plan and Deploy](workflows/plan-and-deploy/plan-and-deploy.md)
2. Operate/update -> [Operate and Update](workflows/operate-and-update/operate-and-update.md)
3. VM, AKS, SQL, images, disks, networks -> [Workload Management](workflows/workload-management/workload-management.md)
4. SDN, NSG, load balancer, gateway, security -> [Networking and Security](workflows/networking-and-security/networking-and-security.md)
5. Failures -> [Troubleshooting](workflows/troubleshooting/troubleshooting.md)

Read the matched workflow first. Use [docs-map](references/docs-map.md). Start read-only. Ask before updates, deletes, reimages, network changes, VM power/delete operations, or Arc bridge/custom location changes.

## Error Handling

| Scenario | Message | Remediation |
| --- | --- | --- |
| Version unknown | Need the Azure Local version before version-specific guidance. | Ask the user for the version or fetch current docs for latest guidance. |
| Risky change detected | This may change cluster, network, VM, or Arc bridge state. | Stop and follow [safety-rules](references/safety-rules.md). |
| No local access | Local host checks are unavailable. | Stay with Azure control-plane checks only. |
| Doc URL 404/redirect | The linked article moved or changed. | Search Learn for the article title with the user's version. |
