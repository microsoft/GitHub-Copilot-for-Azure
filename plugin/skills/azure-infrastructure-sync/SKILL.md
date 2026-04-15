---
name: azure-infrastructure-sync
description: "Compare and synchronize infrastructure artifacts — Draw.io diagrams, Bicep templates, and live Azure resources — to detect drift and divergence. Supports diagram-to-Azure sync (quick and deep modes), Bicep-to-diagram comparison, and Bicep-to-Azure what-if analysis. WHEN: check drift, compare diagram to azure, sync bicep and diagram, bicep what-if, preview bicep changes, detect infrastructure drift, diagram drift, compare bicep deployment, does my diagram match azure, compare bicep to diagram, infrastructure drift detection. DO NOT USE FOR: generating diagrams (use azure-resource-visualizer), generating Bicep (use azure-iac-generator), pre-deployment policy checks (use azure-validate)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Infrastructure Sync

Compare and synchronize infrastructure artifacts to detect drift. Supports four comparison modes across Draw.io diagrams, Bicep templates, and live Azure resources.

## Quick Reference

| Area | Primary MCP tools | CLI fallback | Best for |
|---|---|---|---|
| Diagram ↔ Azure (quick) | Azure resource listing tools, Draw.io MCP | `az resource list`, `az graph query` | Fast existence-based drift checks |
| Diagram ↔ Azure (deep) | Azure resource detail tools, Draw.io MCP | `az resource show`, `az network * show`, `az webapp show` | Property-level drift analysis |
| Bicep ↔ Diagram | Bicep code quality tools, Draw.io MCP | `bicep build`, `az bicep build` | Comparing IaC intent to architecture diagrams |
| Bicep ↔ Azure | Azure resource tools, Bicep code quality tools | `az deployment group what-if`, `az deployment sub what-if` | Previewing deployment impact and live drift |

| Comparison mode | Inputs | Output |
|---|---|---|
| Diagram ↔ Azure (quick) | `.drawio` + Azure scope | Presence report: in sync, diagram only, Azure only |
| Diagram ↔ Azure (deep) | `.drawio` + Azure scope + selected properties | Detailed drift report with normalized property differences |
| Bicep ↔ Diagram | `.bicep` + `.drawio` | Resource mapping report and sync recommendations |
| Bicep ↔ Azure | `.bicep` + parameters + Azure scope | Create/Modify/Delete/No Change preview |

## Prerequisites

| Prerequisite | Required? | Purpose |
|---|---|---|
| Azure CLI (`az`) + active session | **Required** | Live Azure resource queries |
| Draw.io MCP server | Recommended | Programmatic diagram updates during resolution |
| Draw.io VS Code extension | Optional | Preview and edit diagrams |

## MCP Tools

| Tool / capability | Required? | Key parameters | Used for |
|---|---|---|---|
| Azure subscription listing | Optional | `tenant` | Resolve subscription when user does not specify one |
| Azure resource group listing | Optional | `subscription` | Discover candidate scopes for comparison |
| Azure resources in group | Usually | `subscription`, `resource-group` | Enumerate live resources for drift checks |
| Azure resource details | Deep mode | `subscription`, `resource-group`, resource identifiers | Fetch properties for property-level comparison |
| Bicep diagnostics | Bicep modes | `filePath` | Validate Bicep before comparison |
| Bicep formatting | Optional | `filePath` | Normalize Bicep before parsing or review |
| Draw.io diagram access/update | Optional | diagram path, XML payload | Read or update diagram artifacts during sync |

| CLI fallback | When to use | Common parameters | Notes |
|---|---|---|---|
| `az resource list` | MCP resource listing unavailable | `--resource-group`, `--subscription` | Baseline inventory for quick mode |
| `az resource show` | Need raw resource properties | `--ids` or `--name`, `--resource-group`, `--resource-type` | Useful for deep comparisons |
| `az graph query` | Cross-resource-group or broad discovery | `-q`, `--subscriptions` | Good for large scopes |
| `az deployment group what-if` | Validate Bicep against a resource group | `--resource-group`, `--template-file`, `--parameters` | Preferred CLI preview for RG deployments |
| `az deployment sub what-if` | Validate subscription-scope Bicep | `--location`, `--template-file`, `--parameters` | Use for subscription deployments |

## When to Use This Skill

- Check if a Draw.io diagram matches what's deployed in Azure
- Detect drift between Bicep templates and a diagram
- Preview what a Bicep deployment would change (what-if without ARM)
- Synchronize diagram, Bicep, and Azure after changes

## Routing

```
User request
├── Diagram ↔ Azure ("diagram matches azure", "diagram drift", "sync diagram")
│   ├── Quick mode (default) → resource-level existence check
│   │   └─► [diagram-azure-sync-workflow.md]
│   └── Deep mode ("property-level", "deep comparison", "detailed drift")
│       └─► [diagram-azure-sync-deep-workflow.md]
│
├── Bicep ↔ Diagram ("bicep matches diagram", "compare bicep to diagram")
│   └─► [bicep-diagram-sync-workflow.md]
│
└── Bicep ↔ Azure ("bicep what-if", "preview bicep changes", "bicep drift")
    └─► [bicep-whatif-workflow.md]
```

## Workflow References

- **Diagram ↔ Azure (quick)**: [diagram-azure-sync-workflow.md](references/diagram-azure-sync-workflow.md) — Resource-level existence comparison. Reports resources present in diagram only, Azure only, or both.
- **Diagram ↔ Azure (deep)**: [diagram-azure-sync-deep-workflow.md](references/diagram-azure-sync-deep-workflow.md) — Property-level comparison with normalization rules. Reports configuration drift with severity.
- **Bicep ↔ Diagram**: [bicep-diagram-sync-workflow.md](references/bicep-diagram-sync-workflow.md) — Compares Bicep resource definitions against diagram resource model. Offers selective resolution.
- **Bicep ↔ Azure (what-if)**: [bicep-whatif-workflow.md](references/bicep-whatif-workflow.md) — Compares Bicep expected state against live Azure without using ARM what-if. Reports Create/Modify/Delete/No Change.

All workflows use:
- [azure-resource-model.md](references/azure-resource-model.md) — Canonical resource model schema
- [procedures/resource-matching.md](references/procedures/resource-matching.md) — Cross-model matching algorithm

## Drift Report Format

All modes produce a consistent drift report:

```
## Infrastructure Drift Report — <Mode>

| # | Resource | Type | Status |
|---|----------|------|--------|
| 1 | vnet-web | Microsoft.Network/virtualNetworks | ✅ In Sync |
| 2 | app-api | Microsoft.Web/sites | ⬜ Diagram Only |
| 3 | redis-cache | Microsoft.Cache/redis | 🔷 Azure Only |

Summary: 5 In Sync | 1 Diagram Only | 1 Azure Only
```

## Resolution Options

After presenting a drift report, offer:

| Option | Action |
|---|---|
| Update diagram | Add missing Azure resources to diagram, remove diagram-only resources |
| Update Azure/Bicep | Generate Bicep for diagram-only resources, flag Azure-only for removal |
| Selective sync | Let user pick which resources to sync in each direction |
| No action | Report only, no changes |

## Error Handling

| Error | Cause | Remediation |
|---|---|---|
| Not authenticated | No Azure session | Run `az login` — see [azure-authentication.md](references/procedures/azure-authentication.md) |
| Diagram file not found | Wrong path | Ask user for correct `.drawio` file path |
| Bicep parse error | Invalid Bicep syntax | Run `bicep build` to identify syntax errors |
| Draw.io MCP tool not found | MCP server not configured | Diagram updates output as `.drawio` XML file. Install Draw.io MCP for programmatic updates. |
| No resources to compare | Empty scope or diagram | Verify diagram has Azure resources and scope has deployed resources |
