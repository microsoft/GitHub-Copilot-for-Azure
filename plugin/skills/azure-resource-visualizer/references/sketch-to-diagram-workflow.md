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
| 5 | **Verify Against Docs** | **HARD GATE** — For any resource type or configuration you're uncertain about, verify against Microsoft documentation or Bicep MCP `get_az_resource_type_schema`. Do not guess. |
| 6 | **Create Solution Folder** | Create a folder named after the project (e.g., `my-project/`). All output files go here. |
| 7 | **Generate Draw.io Diagram** | Build the Draw.io XML following [drawio-diagram-conventions.md](drawio-diagram-conventions.md). Look up every resource icon in [azure-stencil-mapping.json](azure-stencil-mapping.json). |
| 8 | **Verify Completeness** | Cross-check every resource in the model against the generated XML. Every resource must have an `mxCell`. Every relationship must have an edge. |
| 9 | **Present for Review** | Show the resource model summary and save the `.drawio` file. If Draw.io MCP is available, use it for programmatic creation. |

## Input Handling

| Input Type | How to Process |
|---|---|
| Image/sketch | Analyze visual elements. Map boxes/icons to Azure resource types. Map arrows to relationships. |
| Text description | Parse the description for resource types, quantities, and connections. Build resource model from natural language. |
| Bullet list | Each bullet may be a resource. Indentation implies containment (e.g., VNet > Subnet > VM). |

## Output

- `<project-name>-architecture.drawio` — The Draw.io diagram file
- Resource model summary presented in chat for user verification
