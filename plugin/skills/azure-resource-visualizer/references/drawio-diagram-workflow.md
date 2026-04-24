# Draw.io Diagram Workflow

Generate a Draw.io architecture diagram with Azure stencils from a resource model.

> **Prerequisite:** Complete the discovery procedure in [../SKILL.md](../SKILL.md) (Steps 1–2) to produce a filtered, enriched resource model with mapped relationships. Follow [azure-resource-model.md](azure-resource-model.md) for the model schema.

---

> ⚠️ **Output rule:** Always save the diagram to a file — never dump raw XML in chat.

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Generate Draw.io Diagram** | Build Draw.io XML following [drawio-diagram-conventions.md](drawio-diagram-conventions.md). Look up every icon in [azure-stencil-mapping.json](azure-stencil-mapping.json). |
| 2 | **Save Output** | **HARD GATE** — Create a subdirectory named `<resource-group>-architecture/` and save `<resource-group>-architecture.drawio` inside it. Never save directly in the current directory. Do not present the diagram as complete until the file is confirmed saved. |

## Output Budget Rules

- Save diagrams to files — do not dump large XML in chat
- Minimize inline tables to essential summaries
- Batch Azure CLI calls (use `--query` and `-o tsv` for compact output)
