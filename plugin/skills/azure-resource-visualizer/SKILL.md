---
name: azure-resource-visualizer
description: "Analyze Azure resource groups and generate detailed architecture diagrams as Mermaid or Draw.io. Supports live Azure resource discovery, sketch/description-to-diagram conversion, and detailed relationship mapping. WHEN: create architecture diagram, visualize Azure resources, show resource relationships, generate Mermaid diagram, analyze resource group, diagram my resources, architecture visualization, resource topology, map Azure infrastructure, draw.io diagram, sketch to diagram, convert sketch to architecture, generate draw.io, create draw.io from azure. DO NOT USE FOR: comparing diagrams against live Azure or Bicep, generating Bicep templates."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Resource Visualizer - Architecture Diagram Generator

A user may ask for help understanding how individual resources fit together, or to create a diagram showing their relationships. Your mission is to examine Azure resource groups, understand their structure and relationships, and generate comprehensive architecture diagrams (Mermaid or Draw.io) that clearly illustrate the architecture.

## Prerequisites

- Active connection to Azure through MCP tools or Azure CLI
- Draw.io MCP server (only recommended when creating Draw.io output)
- Draw.io VS Code extension (optional, for viewing `.drawio` files)

## Output Format Routing

Choose the diagram format based on the user's request. If unspecified, default to Mermaid.

| Trigger | Workflow |
|---|---|
| "sketch" / "whiteboard" / "description" | [sketch-to-diagram-workflow.md](references/sketch-to-diagram-workflow.md) |
| "draw.io" / "drawio" / "rich diagram" | [drawio-diagram-workflow.md](references/drawio-diagram-workflow.md) |
| "mermaid" / default | [mermaid-diagram-workflow.md](references/mermaid-diagram-workflow.md) |

See also: [drawio-diagram-conventions.md](references/drawio-diagram-conventions.md) for Draw.io shape, stencil, and layout conventions.

## Core Responsibilities

1. **Resource Group Discovery**: List available resource groups when not specified
2. **Deep Resource Analysis**: Examine all resources, their configurations, and interdependencies
3. **Relationship Mapping**: Identify and document all connections between resources
4. **Diagram Generation**: Create detailed, accurate Mermaid or Draw.io diagrams
5. **Documentation Creation**: Produce a rich output, either in a Draw.io diagram or in markdown files with embedded mermaid diagrams

## Workflow Process

Steps 1 and 2 are the shared discovery procedure used by every renderer (Mermaid and Draw.io). Step 3 routes to the format-specific workflow.

### Step 1: Resource Group Selection

> **Sketch/description input:** If the user provides a sketch, image, or text description instead of a live Azure scope, follow [references/sketch-to-diagram-workflow.md](references/sketch-to-diagram-workflow.md) for input analysis, clarification, and doc-check gating, then continue with Step 3.

If the user hasn't specified a sketch or resource group:

1. **Verify Azure session first** — see [procedures/azure-authentication.md](references/procedures/azure-authentication.md). **HARD GATE** — stop if not authenticated.
2. Use your tools to query available resource groups. If you do not have a tool for this, use `az`.
3. Present a numbered list of resource groups with their locations
4. Ask the user to select one by number or name
5. Wait for user response before proceeding

If a resource group is specified, validate it exists and proceed.

### Step 2: Resource Discovery & Analysis

For bulk resource discovery across subscriptions, use Azure Resource Graph queries. See [Azure Resource Graph Queries](references/azure-resource-graph.md) for cross-subscription inventory and relationship discovery patterns.

Once you have the resource group:

1. **Query all resources** in the resource group using Azure MCP tools or `az`.
2. **Analyze each resource** type and capture:
   - Resource name and type
   - SKU/tier information
   - Location/region
   - Key configuration properties
   - Network settings (VNets, subnets, private endpoints)
   - Identity and access (Managed Identity, RBAC)
   - Dependencies and connections

3. **Map relationships** by identifying:
   - **Network connections**: VNet peering, subnet assignments, NSG rules, private endpoints
   - **Data flow**: Apps → Databases, Functions → Storage, API Management → Backends
   - **Identity**: Managed identities connecting to resources
   - **Configuration**: App Settings pointing to Key Vaults, connection strings
   - **Dependencies**: Parent-child relationships, required resources

4. **Filter the resource list** by applying the "Exclude for Diagrams" column in [procedures/resource-filtering.md](references/procedures/resource-filtering.md). Remove auto-created, hidden, and non-architectural resources.

5. **Check scope size**: If >50 resources remain after filtering, warn the user and offer to split by resource group or layer.

> **Important**: You must only use placeholder names to represent secret values, such as keys, connection strings, Key Vault secrets, etc. Use meaningful placeholder names to represent each secret in the diagram. Never put secret values in the resource diagram.

### Step 3: Diagram Construction

Hand the resource model off to the renderer matching the user's requested format. The format-specific workflow handles diagram construction and file saving.

- **Mermaid** (default): [references/mermaid-diagram-workflow.md](references/mermaid-diagram-workflow.md)
- **Draw.io**: [references/drawio-diagram-workflow.md](references/drawio-diagram-workflow.md)

**Key Diagram Requirements** (apply to both formats):

- **Group by layer or purpose**: Network, Compute, Data, Security, Monitoring
- **Include details**: SKUs, tiers, important settings in node labels
- **Label all connections**: Describe what flows between resources (data, identity, network)
- **Use meaningful node IDs**: Abbreviations that make sense (APP, FUNC, SQL, KV)
- **Visual hierarchy**: Use subgraphs (Mermaid) or containers (Draw.io) for logical grouping

**Resource Type Examples:**
- App Service: Include plan tier (B1, S1, P1v2)
- Functions: Include runtime (.NET, Python, Node)
- Databases: Include tier (Basic, Standard, Premium)
- Storage: Include redundancy (LRS, GRS, ZRS)
- VNets: Include address space
- Subnets: Include address range

## Operating Guidelines

### Quality Standards

- **Accuracy**: Verify all resource details before including in diagram
- **Completeness**: Use [resource-filtering.md](references/procedures/resource-filtering.md) rules to find relevant resources and relationships
- **Clarity**: Use clear, descriptive labels and logical grouping
- **Detail Level**: Include configuration details that matter for architecture understanding
- **Relationships**: Show ALL significant connections, not just obvious ones

### Tool Usage Patterns

1. **Azure MCP Search**: 
   - Use `intent="list resource groups"` to discover resource groups
   - Use `intent="list resources in group"` with group name to get all resources
   - Use `intent="get resource details"` for individual resource analysis
   - Use `command` parameter when you need specific Azure operations

2. **File Creation**:
   - Always create in workspace root or a `docs/` folder if it exists
   - Use clear, descriptive filenames: `[rg-name]-architecture.md`
   - Ensure Mermaid syntax is valid (test syntax mentally before output)

3. **Terminal (when needed)**:
   - Use Azure CLI for complex queries not available via MCP
   - Example: `az resource list --resource-group <name> --output json`
   - Example: `az network vnet show --resource-group <name> --name <vnet-name>`

### Constraints & Boundaries

**Always Do:**
- ✅ List resource groups if not specified
- ✅ Wait for user selection before proceeding
- ✅ Analyze ALL resources in the group
- ✅ Create detailed, accurate diagrams
- ✅ Include configuration details in node labels
- ✅ Group resources logically with subgraphs
- ✅ Label all connections descriptively
- ✅ Create a complete markdown file with diagram

**Never Do:**
- ❌ Skip resources because they seem unimportant
- ❌ Make assumptions about resource relationships without verification
- ❌ Create incomplete or placeholder diagrams
- ❌ Omit configuration details that affect architecture
- ❌ Proceed without confirming resource group selection
- ❌ Generate invalid Mermaid or Draw.io syntax
- ❌ Modify or delete Azure resources (read-only analysis)

### Edge Cases & Error Handling

- **No resources found**: Inform user and verify resource group name
- **Permission issues**: Explain what's missing and suggest checking RBAC
- **Complex architectures (50+ resources)**: Warn the user and offer to split by layer or resource group
- **Cross-resource-group dependencies**: Note external dependencies in diagram notes
- **Resources without clear relationships**: Group in "Other Resources" section
- **Unsupported resource type (Draw.io)**: No stencil mapping available — use a generic labeled node and call out the limitation
- **Draw.io MCP tool not found**: Output `.drawio` XML to a file; the user can open it with the Draw.io VS Code extension
- **Invalid diagram syntax**: For Mermaid, validate before output; for Draw.io, simplify and retry with generic shapes if XML is malformed

## Output Format Specifications

For format-specific syntax (Mermaid graph direction, Draw.io XML, stencil paths), see the renderer workflow selected in Step 3.

### Markdown Structure
- Use H1 for main title
- Use H2 for major sections
- Use H3 for subsections
- Use tables for resource inventories
- Use bullet lists for notes and recommendations
- Use code blocks with `mermaid` language tag for mermaid diagrams

## Success Criteria

A successful analysis includes:
- ✅ Valid resource group identified
- ✅ All resources discovered and analyzed
- ✅ All significant relationships mapped
- ✅ Detailed Mermaid or Draw.io diagram with proper grouping
- ✅ Complete output file created (markdown for Mermaid, `.drawio` for Draw.io)
- ✅ Clear, actionable documentation
- ✅ Valid diagram syntax that renders correctly
- ✅ Professional, architect-level output

Your goal is to provide clarity and insight into Azure architectures, making complex resource relationships easy to understand through excellent visualization.