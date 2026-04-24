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
| "draw.io" / "drawio" / "rich diagram" | [azure-to-diagram-workflow.md](references/azure-to-diagram-workflow.md) |
| "mermaid" / default | [mermaid-diagram-workflow.md](references/mermaid-diagram-workflow.md) |

See also: [drawio-diagram-conventions.md](references/drawio-diagram-conventions.md) for Draw.io shape, stencil, and layout conventions.

## Core Responsibilities

1. **Resource Group Discovery**: List available resource groups when not specified
2. **Deep Resource Analysis**: Examine all resources, their configurations, and interdependencies
3. **Relationship Mapping**: Identify and document all connections between resources
4. **Diagram Generation**: Create detailed, accurate Mermaid diagrams
5. **Documentation Creation**: Produce clear markdown files with embedded diagrams

## Workflow Process

### Step 1: Resource Group Selection

If the user hasn't specified a resource group:

1. Use your tools to query available resource groups. If you do not have a tool for this, use `az`.
2. Present a numbered list of resource groups with their locations
3. Ask the user to select one by number or name
4. Wait for user response before proceeding

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

> **Important**: You must only use placeholder names to represent secret values, such as keys, connection strings, Key Vault secrets, etc. Use meaningful placeholder names to represent each secret in the diagram. Never put secret values in the resource diagram.

### Step 3: Diagram Construction

Build the diagram in the requested format. The requirements below (grouping, labels, relationships) apply to both Mermaid and Draw.io output.

- **Mermaid**: Use `graph TB` (top-to-bottom) or `graph LR` (left-to-right). See [mermaid-diagram-workflow.md](references/mermaid-diagram-workflow.md) and [example-diagram.md](./assets/example-diagram.md).
- **Draw.io**: Follow [azure-to-diagram-workflow.md](references/azure-to-diagram-workflow.md) and [drawio-diagram-conventions.md](references/drawio-diagram-conventions.md). Look up every icon in [azure-stencil-mapping.json](references/azure-stencil-mapping.json). Save `.drawio` XML to a file — never dump raw XML in chat.

**Key Diagram Requirements:**

- **Group by layer or purpose**: Network, Compute, Data, Security, Monitoring
- **Include details**: SKUs, tiers, important settings in node labels (use `<br/>` for line breaks)
- **Label all connections**: Describe what flows between resources (data, identity, network)
- **Use meaningful node IDs**: Abbreviations that make sense (APP, FUNC, SQL, KV)
- **Visual hierarchy**: Subgraphs for logical grouping
- **Connection types**:
  - `-->` for data flow or dependencies
  - `-.->` for optional/conditional connections
  - `==>` for critical/primary paths

**Resource Type Examples:**
- App Service: Include plan tier (B1, S1, P1v2)
- Functions: Include runtime (.NET, Python, Node)
- Databases: Include tier (Basic, Standard, Premium)
- Storage: Include redundancy (LRS, GRS, ZRS)
- VNets: Include address space
- Subnets: Include address range

### Step 4: File Creation

Create a subdirectory `[resource-group-name]-architecture/` and save `[resource-group-name]-architecture.drawio`(draw.io) or `[resource-group-name]-architecture.md`(mermaid) inside it.
**For Mermaid output:** Use [template-architecture.md](./assets/template-architecture.md) as a template and use the followingg structure:

1. **Header**: Resource group name, subscription, region
2. **Summary**: Brief overview of the architecture (2-3 paragraphs)
3. **Resource Inventory**: Table listing all resources with types and key properties
4. **Architecture Diagram**: The complete Mermaid diagram
5. **Relationship Details**: Explanation of key connections and data flows
6. **Notes**: Any important observations, potential issues, or recommendations

**For Draw.io output:** Do not present the diagram as complete until the file is confirmed saved. A companion `.md` summary may accompany it.

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
- ❌ Generate invalid Mermaid syntax
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

### Mermaid Diagram Syntax
- Use `graph TB` (top-to-bottom) for vertical layouts
- Use `graph LR` (left-to-right) for horizontal layouts (better for wide architectures)
- Subgraph syntax: `subgraph "Descriptive Name"`
- Node syntax: `ID["Display Name<br/>Details"]`
- Connection syntax: `SOURCE -->|"Label"| TARGET`

### Markdown Structure
- Use H1 for main title
- Use H2 for major sections
- Use H3 for subsections
- Use tables for resource inventories
- Use bullet lists for notes and recommendations
- Use code blocks with `mermaid` language tag for diagrams

## Success Criteria

A successful analysis includes:
- ✅ Valid resource group identified
- ✅ All resources discovered and analyzed
- ✅ All significant relationships mapped
- ✅ Detailed Mermaid diagram with proper grouping
- ✅ Complete markdown file created
- ✅ Clear, actionable documentation
- ✅ Valid Mermaid syntax that renders correctly
- ✅ Professional, architect-level output

Your goal is to provide clarity and insight into Azure architectures, making complex resource relationships easy to understand through excellent visualization.