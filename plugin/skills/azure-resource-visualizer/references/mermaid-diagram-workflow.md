# Mermaid Diagram Workflow

Generate a Mermaid architecture diagram from a resource model.

> **Prerequisite:** Complete the discovery procedure in [../SKILL.md](../SKILL.md) (Steps 1–2) to produce a filtered resource inventory with mapped relationships.

## Step 3: Diagram Construction

Create a **detailed Mermaid diagram** using `graph TB` (top-to-bottom) or `graph LR` (left-to-right) format. See [example-diagram.md](../assets/example-diagram.md) for a complete sample.

**Requirements:**
- Group by layer or purpose: Network, Compute, Data, Security, Monitoring
- Include SKUs/tiers in node labels (use `<br/>` for line breaks)
- Label all connections describing what flows between resources
- Use meaningful node IDs (APP, FUNC, SQL, KV)
- Use subgraphs for logical grouping
- `-->` data flow, `-.->` optional, `==>` critical path

## Step 4: File Creation

Create a subdirectory in the current working directory named `[resource-group-name]-architecture/`. Never save output files directly in the current directory.

Use [template-architecture.md](../assets/template-architecture.md) as a template and create `[resource-group-name]-architecture/[resource-group-name]-architecture.md` with:

1. **Header**: Resource group name, subscription, region
2. **Summary**: Brief overview (2-3 paragraphs)
3. **Resource Inventory**: Table of all resources with types and key properties
4. **Architecture Diagram**: The complete Mermaid diagram
5. **Relationship Details**: Explanation of key connections and data flows
6. **Notes**: Observations, potential issues, or recommendations
