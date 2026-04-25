# Diagram-to-Bicep Workflow

Parse a Draw.io architecture diagram and generate deployment-ready Bicep templates.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Accept Diagram** | Get the Draw.io file path from the user. Read the `.drawio` XML file. |
| 2 | **Parse to Resource Model** | Apply [diagram-parsing.md](procedures/diagram-parsing.md) to extract resources, containers, and relationships into a resource model per [azure-resource-model.md](azure-resource-model.md). |
| 3 | **Check Existing Bicepparam** | Look for an existing `.bicepparam` file in the project. If found, merge its parameter values (preserving user customizations) with generated defaults. |
| 4 | **Enrich Resource Properties** | For each resource in the model, derive recommended properties using [azure-resource-configs.md](azure-resource-configs.md) and Bicep MCP `get_az_resource_type_schema`. Apply auto-detection rules (e.g., Private Endpoint → disable public access on target). |
| 5 | **Generate Bicep** | Create modular Bicep following [bicep-best-practices.md](bicep-best-practices.md). Use latest stable API versions per [version-currency.md](version-currency.md). Group into `modules/` by layer. Generate `main.bicep` and `main.bicepparam`. |
| 6 | **Run Deployment Verification** | Apply [azure-deployment-verification.md](azure-deployment-verification.md) checks. Fix errors automatically. Present checklist. |
| 7 | **Write README** | Generate a `README.md` describing the architecture, resources, and deployment instructions. |
| 8 | **Save Output** | Write all files to project folder. Present summary. |

## Existing Bicepparam Merge Rules

When a `.bicepparam` file already exists:
1. Read all existing parameter values
2. For parameters that exist in both old and new: keep the existing value (user may have customized)
3. For new parameters: add with generated defaults and comments
4. For removed parameters: comment them out with `// REMOVED:` prefix
5. Always preserve user comments
