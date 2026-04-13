# Azure-to-Diagram Workflow

Discover live Azure resources and generate a Draw.io architecture diagram with Azure stencils.

---

> ⚠️ **Output rule:** Always save the diagram to a file — never dump raw XML in chat.

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Authenticate** | Verify Azure session — see [azure-authentication.md](procedures/azure-authentication.md). **HARD GATE** — stop if not authenticated. |
| 2 | **Accept Inputs** | Get target scope: resource group name(s) or subscription. If not specified, list resource groups and ask user to select. |
| 3 | **Discover Resources** | Query all resources in scope using Azure MCP tools or `az resource list --resource-group <name> -o json`. Batch CLI calls to minimize terminal output. |
| 4 | **Filter Resources** | Apply [resource-filtering.md](procedures/resource-filtering.md) "Exclude for Diagrams" column. Remove auto-created, hidden, and non-architectural resources. |
| 5 | **Check Large Scope** | If >50 resources after filtering, warn the user and offer to split by resource group or layer. |
| 6 | **Enrich Properties** | For key resources (VMs, App Services, databases), retrieve additional properties (SKU, tier, runtime) using MCP tools or `az resource show`. |
| 7 | **Infer Relationships** | Map connections: VNet containment, subnet membership, private endpoints, App Service → database connections, identity assignments. Build the resource model per [azure-resource-model.md](azure-resource-model.md). |
| 8 | **Generate Draw.io Diagram** | Build Draw.io XML following [drawio-diagram-conventions.md](drawio-diagram-conventions.md). Look up every icon in [azure-stencil-mapping.json](azure-stencil-mapping.json). |
| 9 | **Save Output** | **HARD GATE** — Create a subdirectory named `<resource-group>-architecture/` and save `<resource-group>-architecture.drawio` inside it. Never save directly in the current directory. Do not present the diagram as complete until the file is confirmed saved. |

## Output Budget Rules

- Save diagrams to files — do not dump large XML in chat
- Minimize inline tables to essential summaries
- Batch Azure CLI calls (use `--query` and `-o tsv` for compact output)
