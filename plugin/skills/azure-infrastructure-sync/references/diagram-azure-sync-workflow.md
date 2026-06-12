# Diagram ↔ Azure Sync Workflow (Quick Mode)

Resource-level existence comparison between a Draw.io diagram and live Azure.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Authenticate** | Verify Azure session — see [azure-authentication.md](procedures/azure-authentication.md). **HARD GATE**. |
| 2 | **Accept Inputs** | Get: (a) Draw.io file path, (b) Azure scope (resource group or subscription), (c) depth — default `quick`. |
| 3 | **Parse Diagram** | Apply [diagram-parsing.md](procedures/diagram-parsing.md) to extract the diagram resource model. |
| 4 | **Discover Azure Resources** | Query live resources in scope. Apply [resource-filtering.md](procedures/resource-filtering.md) "Exclude for Diagrams" column. |
| 5 | **Match Resources** | Apply [resource-matching.md](procedures/resource-matching.md) across diagram model and Azure model. |
| 6 | **Present Drift Report** | Show status per resource: ✅ In Sync, ⬜ Diagram Only, 🔷 Azure Only. |
| 7 | **Offer Resolution** | Options: update diagram, update Azure (generate Bicep), selective sync, or no action. |
| 8 | **Execute Resolution** | If updating diagram: modify Draw.io XML (add missing, remove extras). Run [azure-deployment-verification.md](azure-deployment-verification.md) before any Azure changes. |
