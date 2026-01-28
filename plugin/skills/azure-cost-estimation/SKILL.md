---
name: azure-cost-estimation
description: Estimate Azure deployment costs before provisioning by analyzing Bicep and ARM templates. Use this skill when users want to understand infrastructure costs, compare pricing across regions, analyze template costs before deployment, or optimize Azure spending. Supports VMs, Storage, SQL Database, App Service, AKS, Container Apps, and more.
---

# Azure Cost Estimation

Estimate Azure deployment costs before provisioning by analyzing Bicep and ARM templates using the Azure Retail Prices API.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "How much will this deployment cost?"
- "Estimate the cost of this Bicep/ARM template"
- "What's the monthly cost of this infrastructure?"
- "Compare pricing across regions"
- "Show me the cost breakdown for my Azure resources"
- "Analyze costs before I deploy"
- "What will my Azure bill be for this?"
- "Is this deployment within my budget?"

**Key Indicators:**
- User has Bicep (.bicep) or ARM (.json) template files
- User mentions cost, pricing, budget, or spending
- User wants to understand infrastructure costs before deployment
- User is comparing deployment options by price
- User mentions Azure Pricing Calculator or wants similar functionality

## Overview

This skill provides pre-deployment cost estimation by:
1. Parsing infrastructure templates (Bicep/ARM)
2. Extracting Azure resources and their configurations
3. Querying the Azure Retail Prices API for current pricing
4. Calculating monthly/yearly costs with itemized breakdowns
5. Providing cost optimization recommendations

```
Template → Parse Resources → Query Prices → Calculate Costs → Generate Report
   ↓            ↓                ↓               ↓                ↓
 .bicep    Extract SKU,      Azure Retail    Monthly +      Markdown table
 .json     location, size    Prices API      yearly totals  with breakdown
```

## Pattern 0: Prerequisites Check

Before estimating costs, verify the environment is ready.

**Required:**
- Python 3.10+ installed
- `requests` library (`pip install requests`)
- Template file accessible

**Optional but recommended:**
- Azure CLI authenticated (for subscription context)
- Parameter file for templates with parameters

**Bash:**
```bash
# Check Python version
python --version

# Install dependencies
pip install requests

# Verify Azure CLI (optional, for subscription info)
az account show
```

**PowerShell:**
```powershell
# Check Python version
python --version

# Install dependencies
pip install requests

# Verify Azure CLI (optional, for subscription info)
az account show
```

## Pattern 1: Template Detection

Identify and locate infrastructure templates in the workspace.

### Step 1: Find Templates

Search for Bicep and ARM templates:

**Bash:**
```bash
# Find Bicep templates
find . -name "*.bicep" -type f

# Find ARM templates (excluding parameter files)
find . -name "*.json" -type f | grep -v parameters
```

**PowerShell:**
```powershell
# Find Bicep templates
Get-ChildItem -Recurse -Filter "*.bicep"

# Find ARM templates (excluding parameter files)
Get-ChildItem -Recurse -Filter "*.json" | Where-Object { $_.Name -notmatch "parameters" }
```

### Step 2: Identify Template Type

| Extension | Type | Detection |
|-----------|------|-----------|
| `.bicep` | Bicep | Native Bicep syntax |
| `.json` | ARM | Contains `$schema` with `deploymentTemplate` |
| `.bicepparam` | Parameters | Bicep parameter file |
| `.parameters.json` | Parameters | JSON parameter file |

### Step 3: Find Associated Parameters

For a template `main.bicep`, look for:
1. `main.bicepparam`
2. `main.parameters.json`
3. `parameters.json` in same directory
4. `parameters/<env>.json`

## Pattern 2: Resource Extraction

Parse templates to extract cost-relevant resource information.

### Bicep Resource Pattern

```bicep
resource myVm 'Microsoft.Compute/virtualMachines@2023-03-01' = {
  name: 'my-vm'
  location: 'eastus'
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_D4s_v3'  // ← Extract this
    }
  }
}
```

**Extract from each resource:**
- Resource type (e.g., `Microsoft.Compute/virtualMachines`)
- Location/region
- SKU/size information
- Quantity (from copy loops)
- Relevant properties affecting cost

### ARM Resource Pattern

```json
{
  "type": "Microsoft.Compute/virtualMachines",
  "apiVersion": "2023-03-01",
  "name": "my-vm",
  "location": "eastus",
  "properties": {
    "hardwareProfile": {
      "vmSize": "Standard_D4s_v3"
    }
  }
}
```

### Resource Type Mappings

| Bicep Type | API Service Name | Cost Factors |
|------------|-----------------|--------------|
| `Microsoft.Compute/virtualMachines` | Virtual Machines | vmSize, OS type, disk |
| `Microsoft.Storage/storageAccounts` | Storage | SKU, redundancy, capacity |
| `Microsoft.Sql/servers/databases` | SQL Database | SKU (DTU/vCore), tier |
| `Microsoft.Web/sites` | App Service | SKU tier, instance count |
| `Microsoft.ContainerService/managedClusters` | Azure Kubernetes Service | Node count, VM size |
| `Microsoft.App/containerApps` | Azure Container Apps | vCPU, memory, requests |
| `Microsoft.DBforPostgreSQL/flexibleServers` | Azure Database for PostgreSQL | SKU, storage size |
| `Microsoft.KeyVault/vaults` | Key Vault | SKU, operations |
| `Microsoft.ContainerRegistry/registries` | Container Registry | SKU tier |
| `Microsoft.OperationalInsights/workspaces` | Log Analytics | Data ingestion, retention |

## Pattern 3: Price Lookup

Query the Azure Retail Prices API for current pricing.

### API Endpoint

```
GET https://prices.azure.com/api/retail/prices?$filter=<odata_filter>
```

**No authentication required** - this is a public API.

### Common Filters

```python
# VM pricing
f"armSkuName eq '{vm_size}' and armRegionName eq '{region}' and serviceName eq 'Virtual Machines'"

# Storage pricing
f"armSkuName eq '{sku}' and armRegionName eq '{region}' and serviceName eq 'Storage'"

# SQL Database pricing
f"armSkuName eq '{sku}' and armRegionName eq '{region}' and serviceName eq 'SQL Database'"

# App Service pricing
f"armSkuName eq '{sku}' and armRegionName eq '{region}' and serviceName eq 'Azure App Service'"
```

### API Response Example

```json
{
  "Items": [{
    "retailPrice": 0.192,
    "unitOfMeasure": "1 Hour",
    "armSkuName": "Standard_D4s_v3",
    "armRegionName": "eastus",
    "serviceName": "Virtual Machines",
    "productName": "Virtual Machines DSv3 Series",
    "skuName": "D4s v3",
    "meterName": "D4s v3",
    "type": "Consumption"
  }]
}
```

### Pricing Considerations

| Factor | Handling |
|--------|----------|
| Windows vs Linux | Filter by `productName` containing "Windows" or not |
| Reserved Instances | Check `reservationTerm` field (1 Year, 3 Years) |
| Spot Pricing | Check `skuName` containing "Spot" |
| Consumption vs DevTest | Filter by `type` field |

## Pattern 4: Cost Calculation

Calculate monthly and yearly costs from hourly prices.

### Calculation Formula

```python
# Standard compute hours per month
HOURS_PER_MONTH = 730  # (365 days * 24 hours) / 12 months

# Monthly cost for compute resources
monthly_cost = hourly_price * HOURS_PER_MONTH

# Yearly cost
yearly_cost = monthly_cost * 12

# Reserved instance savings
reserved_1yr_cost = reserved_1yr_hourly * HOURS_PER_MONTH * 12
reserved_3yr_cost = reserved_3yr_hourly * HOURS_PER_MONTH * 12
```

### Resource-Specific Calculations

| Resource Type | Unit | Calculation |
|---------------|------|-------------|
| VMs | Per Hour | hourly_rate * 730 |
| Storage | Per GB/Month | capacity_gb * gb_rate |
| SQL Database | Per DTU/Hour or Per vCore/Hour | rate * 730 |
| App Service | Per Hour | hourly_rate * 730 |
| Container Apps | Per vCPU-second + Memory GB-second | usage_based |

## Pattern 5: Report Generation

Generate a markdown cost report with itemized breakdown.

### Report Structure

See [references/COST-REPORT-TEMPLATE.md](references/COST-REPORT-TEMPLATE.md) for the complete report template and field descriptions.

**Key sections included in the report:**
- **Summary**: Total monthly/yearly costs and resource count
- **Resource Breakdown**: Itemized costs per resource with SKU and notes
- **Cost Optimization Opportunities**: Recommendations for savings
- **Assumptions**: Pricing basis and calculation assumptions (displayed prominently to clarify that actual costs may vary)
- **Warnings**: Any unresolved parameters or unsupported resources

## Usage Workflow

### Full Estimation Workflow

1. **User Request**: "How much will my deployment cost?"

2. **Find Templates**:
   ```bash
   # Search for templates in workspace
   ls -la *.bicep infra/*.bicep
   ```

3. **Run Cost Estimation**:
   ```bash
   cd plugin/skills/azure-cost-estimation/scripts
   python cost_calculator.py /path/to/template.bicep --region eastus
   ```

4. **Review Report**: Present the generated markdown report to the user

5. **Compare Regions** (optional):
   ```bash
   python cost_calculator.py /path/to/template.bicep --compare-regions eastus,westus2,northeurope
   ```

### Quick Estimation (Single Resource)

For quick price checks without a full template:

```bash
cd plugin/skills/azure-cost-estimation/scripts
python price_lookup.py --service "Virtual Machines" --sku "Standard_D4s_v3" --region eastus
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Estimate before deployment** | Always run cost estimation before `azd up` or `az deployment` |
| **Check multiple regions** | Use `--compare-regions` to find cost-effective regions |
| **Consider reserved instances** | For stable workloads, reserved pricing can save 30-72% |
| **Include all resources** | Ensure templates include all resources (networking, storage, monitoring) |
| **Update regularly** | Azure prices change; re-estimate periodically |
| **Validate with Azure Calculator** | Cross-check estimates with Azure Pricing Calculator for critical deployments |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Price not found" | SKU not available in region | Try different region or check SKU name |
| "Resource type not supported" | Parser doesn't handle this type | Check [RESOURCE-MAPPINGS.md](references/RESOURCE-MAPPINGS.md) for supported types |
| "Parameter not resolved" | Template uses parameters without defaults | Provide parameter file with `--params` |
| API rate limiting | Too many requests | Add delays between requests |
| Incorrect total | Missing resources | Ensure all resources are in template |

## Supported Resource Types

See [references/RESOURCE-MAPPINGS.md](references/RESOURCE-MAPPINGS.md) for the complete list of supported Azure resource types and their pricing API mappings.

## Customer-Specific Pricing (Enterprise Agreements)

For customers with Enterprise Agreements or negotiated discounts, the retail prices may differ from actual billed amounts. To get customer-specific pricing:

**Bash:**
```bash
# Get price sheet for your subscription (requires appropriate permissions)
az consumption pricesheet show --subscription <subscription-id>

# Export to JSON for analysis
az consumption pricesheet show --subscription <subscription-id> -o json > pricesheet.json
```

**PowerShell:**
```powershell
# Get price sheet for your subscription (requires appropriate permissions)
az consumption pricesheet show --subscription <subscription-id>

# Export to JSON for analysis
az consumption pricesheet show --subscription <subscription-id> -o json | Out-File pricesheet.json
```

**Note:** The Price Sheet API requires Cost Management Reader or higher permissions. Customer-specific prices reflect EA discounts, reserved instance pricing, and other negotiated rates. The default estimation uses public retail prices and includes a disclaimer in the report assumptions.

## Additional Resources

- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [Azure Cost Management](https://learn.microsoft.com/en-us/azure/cost-management-billing/)
- [Azure Consumption Price Sheet API](https://learn.microsoft.com/en-us/rest/api/consumption/price-sheet)
- [ACE - Azure Cost Estimator](https://github.com/TheCloudTheory/arm-estimator) - Related open-source tool
