# Diagram-to-Bicep Workflow

Parse a Draw.io architecture diagram and generate deployment-ready Bicep templates.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Accept Diagram** | Get the Draw.io file path from the user. Read the `.drawio` XML file. |
| 2 | **Parse to Resource Model** | Apply [diagram-parsing.md](procedures/diagram-parsing.md) to extract resources, containers, and relationships into a resource model per [azure-resource-model.md](azure-resource-model.md). |
| 3 | **Create Output Folder** | Create a folder named after the scope (the diagram filename without extension, e.g., `my-architecture/` for `my-architecture.drawio`). All generated files go inside this folder per the layout in [SKILL.md](../SKILL.md). **Never** write files to the repository root. |
| 4 | **Merge Existing Bicepparam** | If a `.bicepparam` file already exists in the output folder, parse it per [bicep-parsing.md](procedures/bicep-parsing.md) and apply the **Existing Bicepparam Merge Rules** below. If none exists, skip. |
| 5 | **Enrich Resource Properties** | For each resource in the model, derive recommended properties using [azure-resource-configs.md](azure-resource-configs.md) and Bicep MCP `get_az_resource_type_schema`. Apply auto-detection rules (e.g., Private Endpoint → disable public access on target). |
| 6 | **Generate Bicep** | Create modular Bicep following [bicep-best-practices.md](bicep-best-practices.md) and the folder layout in [SKILL.md](../SKILL.md). Use latest stable API versions per [version-currency.md](version-currency.md). Group into `modules/` by layer. Generate `main.bicep` and `main.bicepparam`. |
| 7 | **Run Deployment Verification** | Apply [azure-deployment-verification.md](azure-deployment-verification.md) checks. Automatically fix errors; if a fix is not possible, notify the user and present the issue. Present checklist. |
| 8 | **Write README** | Generate a `README.md` inside the output folder. MUST include the same explicit sections as the azure-to-bicep workflow: 1) Original request — the user's exact prompt; 2) Source — diagram file path, parse date; 3) Verification results — pass/warning/error summary; 4) Generated files — table of every file with description; 5) Resource summary — count by type; 6) Secrets — count of detected secrets requiring manual configuration; 7) Deploy commands — `az deployment group create` and `New-AzResourceGroupDeployment` examples; 8) Next steps — populate secrets, post-deploy validation. |
| 9 | **Save Output & Present Summary** | Write all files to the output folder. Show in chat: resource count, file count, verification results, and the path to the generated folder. Do NOT echo full Bicep content. |

## Existing Bicepparam Merge Rules

When a `.bicepparam` file already exists:
1. Read all existing parameter values
2. For parameters that exist in both old and new: keep the existing value (user may have customized)
3. For new parameters: add with generated defaults and comments
4. For removed parameters: comment them out with `// REMOVED:` prefix
5. Always preserve user comments
