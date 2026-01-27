# Azure Quick Review Skill

Run Azure Quick Review (azqr) to generate compliance and governance reports that identify cost-impacting issues and orphaned resources.

## When to Use This Skill

Use this skill when the user asks to:
- Scan Azure subscription for issues or waste
- Find orphaned or unused Azure resources
- Run Azure Quick Review or azqr
- Audit Azure resources for compliance
- Identify quick cost optimization wins
- Check for governance violations

## Instructions

Follow these steps in conversation with the user:

### Step 1: Create Filters Configuration

Create a `filters.yaml` file to focus the scan on cost optimization:

**Use the `create_file` tool** with path `filters.yaml` and content:
```yaml
includeSections:
  - Costs
  - Advisor
  - Inventory
  - Orphaned
excludeSections:
  - Recommendations
  - AzurePolicy
  - DefenderRecommendations
```

> **Important**: Always use the `create_file` tool instead of shell commands to ensure cross-platform compatibility.

### Step 2: Run the azqr Scan

Execute the scan using Azure MCP or CLI:

```powershell
# Via Azure MCP (preferred if available)
# Use the mcp_azure_mcp_extension_azqr tool with subscription and optional resource-group parameters

# Or via direct CLI:
azqr scan --subscription "<SUBSCRIPTION_ID>" --resource-group "<RESOURCE_GROUP>" --filters ./filters.yaml --output json
```

### Step 3: Save Output

Save all generated files to the `output/` folder:
1. Create the folder: `mkdir output` (if it doesn't exist)
2. Save the azqr report as: `output/azqr_report_<YYYYMMDD_HHMMSS>.json`

### Step 4: Clean Up

After the scan completes, delete the temporary `filters.yaml` file:

```powershell
Remove-Item filters.yaml
```

## Output

The skill generates a JSON report with recommendations categorized by impact level (High/Medium/Low), including:
- Orphaned resources (NICs, disks, IPs)
- Azure Advisor cost recommendations  
- Resource inventory
- Cost breakdown by resource

## Important Notes

- azqr provides qualitative governance recommendations
- Always validate findings with actual cost data before making changes
- The tool requires Reader role on the subscription or resource group
- Save reports to `output/` folder with timestamps for audit trail
