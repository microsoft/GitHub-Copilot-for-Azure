# Workflow Process

## Step 1: Resource Group Selection

If the user hasn't specified a resource group:

1. Use your tools to query available resource groups. If you do not have a tool for this, use `az`.
2. Present a numbered list of resource groups with their locations
3. Ask the user to select one by number or name
4. Wait for user response before proceeding

If a resource group is specified, validate it exists and proceed.

## Step 2: Resource Discovery & Analysis

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

## Step 3: Diagram Construction

Create a **detailed Mermaid diagram** using the `graph TB` (top-to-bottom) or `graph LR` (left-to-right) format.

## Step 4: File Creation

Use [template-architecture.md](../assets/template-architecture.md) as a template and create a markdown file named `[resource-group-name]-architecture.md` with:

1. **Header**: Resource group name, subscription, region
2. **Summary**: Brief overview of the architecture (2-3 paragraphs)
3. **Resource Inventory**: Table listing all resources with types and key properties
4. **Architecture Diagram**: The complete Mermaid diagram
5. **Relationship Details**: Explanation of key connections and data flows
6. **Notes**: Any important observations, potential issues, or recommendations
