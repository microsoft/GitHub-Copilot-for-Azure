---
name: azure-infrastructure-sync
description: "Compare and synchronize infrastructure artifacts — Draw.io diagrams, Bicep templates, and live Azure resources — to detect drift and divergence. Supports diagram-to-Azure sync (quick and deep modes), Bicep-to-diagram comparison, and Bicep-to-Azure drift comparison. WHEN: check drift, compare diagram to azure, sync bicep and diagram, detect infrastructure drift, diagram drift, compare bicep to azure, does azure match bicep, does my diagram match azure, compare bicep to diagram, infrastructure drift detection. DO NOT USE FOR: generating diagrams (use azure-resource-visualizer), generating Bicep (use azure-iac-generator), pre-deployment validation, ARM/Bicep what-if previews, template validation, deployment readiness checks, or policy checks (use azure-validate)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Infrastructure Sync

Compare and synchronize infrastructure artifacts to detect drift. Supports four comparison modes across Draw.io diagrams, Bicep templates, and live Azure resources.

Scope: comparison and drift analysis only. This skill does not perform deployment readiness validation, ARM/Bicep what-if preview, template validation, or policy compliance checks; use `azure-validate` for those workflows.

## Prerequisites

| Prerequisite | Required? | Purpose |
|---|---|---|
| Azure CLI (`az`) + active session | **Required** | Live Azure resource queries |
| Draw.io MCP server | Recommended | Programmatic diagram updates during resolution |
| Draw.io VS Code extension | Optional | Preview and edit diagrams |

## When to Use This Skill

- Check if a Draw.io diagram matches what's deployed in Azure
- Detect drift between Bicep templates and a diagram
- Compare Bicep-declared state to deployed Azure resources to identify drift
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
└── Bicep ↔ Azure ("compare bicep to azure", "does azure match bicep", "bicep drift")
    └─► [bicep-whatif-workflow.md]
```

## Workflow References

- **Diagram ↔ Azure (quick)**: [diagram-azure-sync-workflow.md](references/diagram-azure-sync-workflow.md) — Resource-level existence comparison. Reports resources present in diagram only, Azure only, or both.
- **Diagram ↔ Azure (deep)**: [diagram-azure-sync-deep-workflow.md](references/diagram-azure-sync-deep-workflow.md) — Property-level comparison with normalization rules. Reports configuration drift with severity.
- **Bicep ↔ Diagram**: [bicep-diagram-sync-workflow.md](references/bicep-diagram-sync-workflow.md) — Compares Bicep resource definitions against diagram resource model. Offers selective resolution.
- **Bicep ↔ Azure (drift comparison)**: [bicep-whatif-workflow.md](references/bicep-whatif-workflow.md) — Compares Bicep-declared state against live Azure resource state for drift analysis. This is not a deployment readiness or policy validation workflow. Reports Create/Modify/Delete/No Change.

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
