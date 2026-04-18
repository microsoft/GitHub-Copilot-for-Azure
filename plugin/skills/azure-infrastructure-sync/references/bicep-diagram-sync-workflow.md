# Bicep ↔ Diagram Sync Workflow

> **Canonical copy:** This shared reference is duplicated across Azure infrastructure skills. Keep parallel copies synchronized when updating shared guidance.

Compare Bicep template resources against a Draw.io diagram to detect resource-level divergence.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Accept Inputs** | Get: (a) project folder containing Bicep files, (b) Draw.io file path, (c) optionally a specific `.bicep` file if not using `main.bicep`. |
| 2 | **Parse Diagram** | Apply [diagram-parsing.md](procedures/diagram-parsing.md) to build diagram resource model. |
| 3 | **Parse Bicep** | Apply [bicep-parsing.md](procedures/bicep-parsing.md) to build Bicep resource model. Read `.bicepparam` to resolve parameter values. |
| 4 | **Match Resources** | Apply [resource-matching.md](procedures/resource-matching.md) across diagram and Bicep models. |
| 5 | **Present Drift Report** | Show status: ✅ In Sync, ⬜ Diagram Only, 📄 Bicep Only. |
| 6 | **Offer Resolution** | Options: update Bicep (add resources from diagram), update diagram (add resources from Bicep), selective, or no action. |
| 7 | **Execute Resolution** | If updating Bicep: generate new resource blocks following [bicep-best-practices.md](bicep-best-practices.md). Run [azure-deployment-verification.md](azure-deployment-verification.md) before finalizing. If updating diagram: modify Draw.io XML. |
