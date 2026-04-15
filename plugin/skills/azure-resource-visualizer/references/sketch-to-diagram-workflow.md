# Sketch-to-Diagram Workflow

Convert rough sketches, whiteboard photos, or text descriptions into Draw.io architecture diagrams with Azure stencils.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Analyze Input** | Examine the sketch/image or text description. Identify Azure resource types, groupings, and connections. |
| 2 | **Build Resource Model** | Create a structured resource model following [azure-resource-model.md](azure-resource-model.md). Map each element to an Azure resource type. |
| 3 | **Ask Clarifying Questions** | If resource types are ambiguous (e.g., "database" without specifying SQL vs Cosmos), ask the user. List assumptions for confirmation. |
| 4 | **Validate Architecture** | Check that the architecture makes sense: required companion resources exist (e.g., App Service Plan for App Service), networking is consistent. |
| 5 | **Verify Against Docs** | **HARD GATE — Always required, no exceptions.** Fetch the relevant Microsoft Learn documentation for every resource type and connection pattern in the diagram. Confirm placement, relationships, and constraints are correct (e.g., NIC must reside inside a subnet, Private Endpoint is inbound-only). Document any issues found. |
| 6 | **Create Solution Folder** | Create a subdirectory in the current working directory named after the output file without extension (e.g., `./my-project-architecture/`). All output files go here. Never save directly in the current directory. |
| 7 | **Generate Draw.io Diagram** | Build the Draw.io XML following [drawio-diagram-conventions.md](drawio-diagram-conventions.md). Look up every resource icon in [azure-stencil-mapping.json](azure-stencil-mapping.json). |
| 8 | **Verify Completeness** | Cross-check every resource in the model against the generated XML. Every resource must have an `mxCell`. Every relationship must have an edge. |
| 9 | **Present Doc-Check Results** | **HARD GATE — Always required.** Before showing the diagram, present a summary of what was verified against Microsoft documentation, any corrections made, and any assumptions that still require the user's confirmation. Use the format in the [Doc-Check Report](#doc-check-report) section below. |
| 10 | **Ask User to Verify** | **HARD GATE — Always required.** Explicitly ask: *"Please review the diagram and the documentation notes above. Does this match your intended architecture? Should any resources or connections be changed?"* Do not consider the task complete until the user confirms or requests changes. |

## Input Handling

| Input Type | How to Process |
|---|---|
| Image/sketch | Analyze visual elements. Map boxes/icons to Azure resource types. Map arrows to relationships. |
| Text description | Parse the description for resource types, quantities, and connections. Build resource model from natural language. |
| Bullet list | Each bullet may be a resource. Indentation implies containment (e.g., VNet > Subnet > VM). |

## Doc-Check Report

After generating the diagram, always present a report in this format before asking the user to verify:

```
## Documentation Check
| Resource / Connection | Verified Against | Finding | Action Taken |
|---|---|---|---|
| <resource or arrow> | <docs URL> | Correct / Issue found | None / Corrected to ... |
```

If all resources are correct, say so explicitly. If corrections were made, describe what changed and why.

## Output

- `<project-name>-architecture.drawio` — The Draw.io diagram file
- Documentation check report presented in chat
- Explicit user confirmation received before task is considered complete
