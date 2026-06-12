---
name: azure-arc-servers
description: "Azure Arc-enabled servers router. WHEN: Arc Server, Arc-enabled server, Connected Machine agent, azcmagent, hybrid server, on-prem server, onboard to Arc, project a server into Azure, connect machine to Azure, install Connected Machine agent, generate onboarding script, at-scale onboarding, Group Policy onboarding, Configuration Manager onboarding, Ansible onboarding, Service Principal for Arc, Arc Private Link Scope, Arc Gateway, proxy for Arc, agent connectivity, agent status, Connected / Disconnected / Expired / Error, agent upgrade, automatic upgrade, manual upgrade, Extended Security Updates (ESU) for Arc, Hotpatch on Arc, Pay-as-you-go Windows Server, Software Assurance benefits, Microsoft.HybridCompute, hybridcompute/machines. PREFER OVER azure-compute when the user is talking about non-Azure (on-prem, other-cloud, edge) servers being projected into Azure - not about creating an Azure VM."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Arc-Enabled Servers Skill

Routes Azure Arc server (Connected Machine) requests to the right workflow.

## When to use this skill

Use this skill when the user is talking about **servers that live outside
of Azure compute** (on-prem, AWS / GCP, edge, customer datacenter) and
wants to **project them into Azure** so they can be managed with Azure
control plane tools (Policy, Update Manager, Monitor, Defender, etc.).

The defining ARM resource type is `Microsoft.HybridCompute/machines`.
The defining agent is `azcmagent` (Azure Connected Machine agent).

> **Disambiguate with `azure-compute`.** If the user wants to create a
> brand-new VM **inside Azure** (`Microsoft.Compute/virtualMachines`),
> route to `azure-compute`. Arc servers are **never** new VMs - the
> machine already exists.

> **Disambiguate with `azure-local` / `arc-vmware` / `arc-scvmm`.** Those
> skills handle Arc-enabled infrastructure where Azure stamps **new** VMs
> on customer hardware through a Resource Bridge / Custom Location. This
> skill is for the simpler case where a machine already exists and just
> needs an agent installed.

## Routing

```text
Arc server intent?
├── Connect / onboard / install agent / generate script (one machine or many)
│   → arc-server-onboard
│
├── Agent shows Disconnected / Expired / Error
│   Can't reach Azure / azcmagent connect fails / port blocked
│   → arc-server-troubleshoot
│
├── Upgrade the agent / enable auto-upgrade
│   Buy / activate Extended Security Updates (ESU)
│   Enable Hotpatch / Pay-as-you-go Windows Server licensing
│   → arc-server-manage
│
└── Unclear → ask which of the three above
```

**Routing rule.** Read the matched workflow file *before* any reference
file. The workflow file owns the step-by-step guidance; references are
looked up on demand from inside the workflow.

## Workflows

| Workflow | File | Use when |
|---|---|---|
| **Onboard** | [arc-server-onboard.md](workflows/arc-server-onboard/arc-server-onboard.md) | User wants to connect one or many existing servers to Azure Arc. Generates the install script and walks the connectivity / auth / management-service choices. |
| **Troubleshoot** | [arc-server-troubleshoot.md](workflows/arc-server-troubleshoot/arc-server-troubleshoot.md) | Agent status is not `Connected`, install failed, machine fell offline, or extensions won't deploy. |
| **Manage** | [arc-server-manage.md](workflows/arc-server-manage/arc-server-manage.md) | Day-2 operations: agent upgrades, ESU licensing, Hotpatch, Pay-as-you-go Windows Server, recommended policies, management services (Update Manager, Insights, Change Tracking, Defender, Machine Config). |

## Skill-level references

These references describe concepts that apply across all workflows. Load
them on demand if the user asks the underlying question.

| Reference | Use when |
|---|---|
| [arc-vs-azure-vm.md](references/arc-vs-azure-vm.md) | User is confused about Arc vs Azure VM, asks "should I use Arc or just create a VM", or talks about Arc as if it were a VM service. |
| [arc-mcp-tools.md](references/arc-mcp-tools.md) | Lookup of Azure MCP and `az` CLI commands for `Microsoft.HybridCompute`. Read before invoking tools. |

## Out of scope for this skill

| Request | Route to |
|---|---|
| Create / size / price an Azure VM | `azure-compute` |
| Azure Local cluster, Arc VM on HCI | `azure-local` (proposed) |
| Arc-enabled VMware vCenter | `arc-vmware` (proposed) |
| Arc-enabled SCVMM | `arc-scvmm` (proposed) |
| Arc Appliance / Resource Bridge | `arc-resource-bridge` (proposed) |
| AWS / GCP multi-cloud connector | `arc-multicloud` (proposed) |
| Deploy an application onto an Arc server | `azure-prepare` (then this skill for Arc-specific prereqs) |
| Essential Machine Management subscription enrollment | `azure-compute` → `essential-machine-management` workflow |
