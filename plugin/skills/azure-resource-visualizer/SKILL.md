---
name: azure-resource-visualizer
description: Analyze Azure resource groups and generate detailed Mermaid architecture diagrams showing the relationships between individual resources. Use this skill when the user asks for a diagram of their Azure resources or help in understanding how the resources relate to each other.
---

# Azure Resource Visualizer

Generate Mermaid architecture diagrams from Azure resource groups, showing resource relationships and dependencies.

## When to Use

- User asks for a diagram of Azure resources
- User wants to understand how resources relate to each other
- User needs architecture documentation for a resource group

## Commands

| Action | Tool/Command |
|--------|--------------|
| List resource groups | Azure MCP: `intent="list resource groups"` or `az group list` |
| List resources | Azure MCP: `intent="list resources in group"` or `az resource list -g <name>` |
| Get resource details | Azure MCP: `intent="get resource details"` |

## Quick Workflow

1. **Select resource group** - List available groups if not specified, confirm selection
2. **Discover resources** - Query all resources, analyze types, configs, relationships
3. **Build diagram** - Create Mermaid `graph TB` with subgraphs by layer (Network, Compute, Data, Security)
4. **Create file** - Use [template-architecture.md](./assets/template-architecture.md), save as `[rg-name]-architecture.md`

## Key Rules

- Always confirm resource group before proceeding
- Include ALL resources - never skip any
- Group by layer using subgraphs
- Label all connections with what flows between them
- Read-only analysis - never modify Azure resources

## References

- [Workflow Details](./references/workflow.md)
- [Mermaid Diagram Guide](./references/diagram-guide.md)
- [Operating Guidelines](./references/guidelines.md)
