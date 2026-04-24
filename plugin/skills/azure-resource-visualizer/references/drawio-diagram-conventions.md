# Draw.io Diagram Conventions

---

## 1. Canvas Wrapper Format

Always wrap diagrams in the `<mxfile><diagram>` structure. Never emit a bare `<mxGraphModel>`.

```xml
<mxfile>
  <diagram name="Architecture Overview" id="overview">
    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1900" pageHeight="1000" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- resource and edge cells here -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

**Page dimension defaults:**
- Standard: `pageWidth="1900" pageHeight="1000"` (RG container: `x=20 y=20 w=1820 h=930`)
- Compact 3-tier web app (≤15 resources): `pageWidth="1400" pageHeight="780"`

Multi-page files: use one `<diagram>` element per page inside a single `<mxfile>`.

---

## 2. Stencil Mapping Lookup

**MANDATORY**: Check [azure-stencil-mapping.json](azure-stencil-mapping.json) for every resource type before constructing any icon path. The mapping lists all known exceptions — wrong categories, non-existent files, and naming surprises. Do NOT skip this step or guess based on the ARM namespace.

For resource types genuinely absent from the mapping, derive the path from the azure2 stencil convention:
```
img/lib/azure2/<category>/<PascalCase_Resource_Name>.svg
```

**Critical known traps:**
- `Microsoft.Web/sites` (App Service) → `img/lib/azure2/app_services/App_Services.svg`
- `Microsoft.Web/serverFarms` (App Service Plan) → `img/lib/azure2/app_services/App_Service_Plans.svg` (**not** `compute/`)
- There is no generic `Event_Grid.svg` — use `System_Topic.svg`, `Event_Grid_Topics.svg`, or `Event_Grid_Domains.svg`
- `Microsoft.AppConfiguration/configurationStores` → `img/lib/mscae/App_Configuration.svg` — this icon is in the **mscae** library, **not** azure2. There is no `App_Configuration.svg` or `App_Configurations.svg` in azure2 at all; using any azure2 path produces an empty broken icon.
- When uncertain about any path, verify it exists at `https://github.com/jgraph/drawio/tree/dev/src/main/webapp/img/lib/azure2`
- If no match, use the closest available icon and note the gap

---

## 3. Resource Shape Rules

For each resource icon cell:
- **Style**: `aspect=fixed;html=1;points=[];align=center;image;resizable=0;image=<imagePath>;verticalLabelPosition=bottom;verticalAlign=top;`
- **`verticalLabelPosition=bottom;verticalAlign=top;` is required on every icon cell.** Without it the label renders over the icon, making the shape appear broken or invisible.
- Do NOT include `imageAspect=0;` — it stretches non-square SVGs and distorts icons.
- For icons marked `requiresImageAspect1: true` in `azure-stencil-mapping.json` (currently: **Application Insights**), you MUST add `imageAspect=1;` to the style string. This tells Draw.io to preserve the SVG's native non-square proportions. Omitting it on these icons causes visible distortion.
- **Label**: set to the resource name
- **Size**: use `defaultWidth`/`defaultHeight` from the stencil mapping (typically 48–50px square)

---

## 4. Container Shape Rules

Resource Groups, VNets, and Subnets are containers. All use `container=1;collapsible=0;pointerEvents=0;rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;fontStyle=1;`

| Container | fillColor | strokeColor | Border |
|-----------|-----------|-------------|--------|
| Resource Group | `#fff2cc` | `#d6b656` | solid |
| VNet | `#dae8fc` | `#6c8ebf` | `dashed=1;dashPattern=5 5` |
| Subnet | `#e1d5e7` | `#9673a6` | `dashed=1;dashPattern=2 2` |

**Icon cell inside each container**: Create a 30×30 image `mxCell` at `x=10, y=10` relative to the container, using the container resource's `imagePath` from the stencil mapping. ID convention: `<container-id>-icon`.

**Container sizing** (size to content — never expand to fill canvas):
- Subnet with 1 icon ≈ 200–250px wide; 2–4 icons ≈ 300–500px wide
- VNet: wrap its subnets with ~20px margins on all sides
- Resource Group: wrap the VNet and any outside resources with ~30px margins
- Oversized empty containers are a diagram quality defect

---

## 5. Edge Rules

**Parent**: Always set `parent="1"` (the root cell) on every edge, regardless of where source/target cells live in the container hierarchy. This prevents Draw.io routing errors for cross-container edges.

**Labels (required)**: Every edge MUST have a short descriptive `value`. Never leave `value=""`. Use the relationship type and direction as a guide (e.g., `"hosts"`, `"reads secrets"`, `"VNet integration"`, `"private link"`, `"backend pool"`, `"VNet peering"`).

**Label length limit**: Edge labels MUST be ≤30 characters. Long labels crowd the diagram and collide with other edges. Truncate or rephrase: prefer terse relationship descriptors (`"reads secrets"`, `"blob storage"`, `"diagnostics"`) over full technical strings. If the full detail is needed, put it in a tooltip or a numbered legend below the diagram rather than inline on the edge.

All edges: `rounded=1;orthogonalLoop=1;jettySize=auto;html=1;`

**Style by relationship type:**

| Relationship | strokeColor | strokeWidth | Other |
|-------------|-------------|-------------|-------|
| `connects` (data flow) | `#0078D4` | 2 | `endArrow=block;endFill=1` |
| `depends` (dependency) | `#999999` | 1 | `dashed=1;endArrow=open;endFill=0` |
| `secures` (private link / security) | `#E81123` | 2 | `endArrow=block;endFill=1` |
| `peers` (VNet integration / network) | `#00A4EF` | 2 | `dashed=1` |
| `routes` (routing) | `#0078D4` | 2 | `endArrow=block;endFill=1` |

**Managed Identities**: Every Managed Identity (`Microsoft.ManagedIdentity/userAssignedIdentities`) MUST have at least one `depends` edge connecting it to the resource it is assigned to (e.g. the App Service, App Gateway, or VM that uses it). A Managed Identity with no edges is a diagram defect — it conveys no architectural information and appears as an orphaned icon.

**Edge overlap prevention**: When multiple edges share the same source or target, routing through the same corridor produces overlapping lines that are unreadable. To reduce overlap:
- **Spatial separation**: place resources with many connections (hub nodes) in an open position with distinct compass directions available for each peer — see [layout-rules.md](layout-rules.md) §3 Hub-and-spoke.
- **Stagger parallel routes**: for two edges that would naturally follow the same path (e.g. both from Function App to different resources in the same column), shift one source/target resource at least 80px off-axis so the router assigns different segments.
- **Never add explicit waypoints** (`<Array as="points">` or `exitX/entryX`) as a first resort — repositioning the node always produces cleaner output.
- If layout alone cannot separate a dense cluster of edges, use `edgeStyle=elbowEdgeStyle;elbow=vertical;` on the lower-priority edge to force a different bend axis.

## 6. VNet Integration Special Case

An App Service connected to a VNet Integration subnet is **not** a traffic hop.

- **Do NOT** place the App Service inside the integration subnet container
- **Do NOT** draw a directed `connects` edge to the subnet
- **Do**: keep the App Service **outside** the VNet container
- **Do**: draw a dashed `peers` edge from the App Service to the integration subnet, labeled `"VNet integration"`
- **Do**: label the subnet with its delegation (e.g., `"snet-integration (delegated: Microsoft.Web/serverFarms)"`)

This matches how Azure documentation illustrates VNet Integration: the App Service joins the subnet's address space for outbound routing but is not physically placed in the VNet.

---

## 7. Layout Rules

See [layout-rules.md](layout-rules.md) for full guidance covering screen-fit targets, left-to-right flow vs. zone grid selection, hub-and-spoke, semantic proximity, network topology page layout, and anti-patterns to avoid.

---

## 8. Pre-delivery Completeness Verification

Before presenting to the user, cross-check the generated XML against the resource model:

1. For every resource in the resource model, verify its `id` appears as an `mxCell` in the XML.
2. For every container (Resource Group, VNet, Subnet), verify both the container `mxCell` and its icon `mxCell` (`<id>-icon`) exist.
3. For every relationship, verify a corresponding edge `mxCell` exists with the correct `source` and `target`.
4. Verify all edges have `parent="1"`.

**If any resource is missing from the XML, do NOT proceed** — fix the XML before presenting to the user.

Present the verification as a checklist:
```
## Pre-delivery Verification
- [x] vm-01 (Virtual Machine) → mxCell found
- [x] vnet-01 (VNet container + icon) → mxCells found
- [x] subnet-01 (Subnet container + icon) → mxCells found
- [x] edge-vm-nic → mxCell found, parent="1" ✓

All resources verified. Proceeding to save.
```
