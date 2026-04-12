# Mermaid Diagram Workflow

## Step 1: Resource Group Selection

If the user hasn't specified a resource group:

1. Use your tools to query available resource groups. If you do not have a tool for this, use `az`.
2. Present a numbered list of resource groups with their locations.
3. Ask the user to select one by number or name.
4. Wait for user response before proceeding.

For bulk resource discovery across subscriptions, use Azure Resource Graph queries. See [azure-resource-graph.md](azure-resource-graph.md) for cross-subscription inventory patterns.

## Step 2: Resource Discovery & Analysis

1. **Query all resources** in the resource group using Azure MCP tools or `az`.
2. **Analyze each resource** type and capture:
   - Resource name and type, SKU/tier, location/region
   - Network settings (VNets, subnets, private endpoints)
   - Identity and access (Managed Identity, RBAC)
   - Key configuration properties
3. **Map relationships** by identifying:
   - **Network**: VNet peering, subnet assignments, NSG rules, private endpoints
   - **Data flow**: Apps → Databases, Functions → Storage, APIM → Backends
   - **Identity**: Managed identities connecting to resources
   - **Configuration**: App Settings → Key Vaults, connection strings

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

Use [template-architecture.md](../assets/template-architecture.md) as a template and create `[resource-group-name]-architecture.md` with:

1. **Header**: Resource group name, subscription, region
2. **Summary**: Brief overview (2-3 paragraphs)
3. **Resource Inventory**: Table of all resources with types and key properties
4. **Architecture Diagram**: The complete Mermaid diagram
5. **Relationship Details**: Explanation of key connections and data flows
6. **Notes**: Observations, potential issues, or recommendations
