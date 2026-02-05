# Check Model Availability in Microsoft Foundry

This reference provides guidance for checking regional availability of AI models in Microsoft Foundry, understanding deployment constraints, and selecting optimal regions for model deployments.

## Quick Reference

| Property | Value |
|----------|-------|
| **CLI Commands** | `az cognitiveservices model list`, `az cognitiveservices account list-skus` |
| **MCP Tools** | `foundry_models_list` |
| **Key Factors** | Region, model version, capacity, SKU availability |
| **Best For** | Pre-deployment planning, capacity validation, region selection |

## When to Use

Use this reference when the user wants to:

- **Check if a model is available** in a specific region
- **Find regions** that support a specific model
- **Compare model versions** across regions
- **Plan multi-region deployments**
- **Troubleshoot deployment failures** due to unavailability
- Answer questions like "Can I deploy GPT-4.1 in West Europe?"

## Understanding Model Availability

### Availability Factors

Model availability depends on several factors:

| Factor | Description | Impact |
|--------|-------------|--------|
| **Region** | Azure region (e.g., East US, West Europe) | Primary constraint - not all models in all regions |
| **Model Version** | Specific version (e.g., 2024-05-13) | Newer versions may have limited availability |
| **Model SKU** | Deployment tier (Standard, Premium) | Affects capacity and features |
| **Capacity** | Available quota in region | High-demand regions may be at capacity |
| **Preview vs GA** | General Availability status | Preview models have limited regions |

### Regional Differences

```
┌─────────────────────┬──────────────┬──────────────┬──────────────┐
│ Model               │ East US      │ West Europe  │ Southeast Asia│
├─────────────────────┼──────────────┼──────────────┼──────────────┤
│ GPT-4o              │ ✓ GA         │ ✓ GA         │ ✓ GA         │
│ GPT-4o-mini         │ ✓ GA         │ ✓ GA         │ ✓ Preview    │
│ GPT-4 Turbo         │ ✓ GA         │ ✓ GA         │ ✓ GA         │
│ GPT-3.5 Turbo       │ ✓ GA         │ ✓ GA         │ ✓ GA         │
│ DALL-E 3            │ ✓ GA         │ ✓ Preview    │ ✗ Not avail  │
│ Whisper             │ ✓ GA         │ ✓ GA         │ ✓ Preview    │
│ Text Embedding      │ ✓ GA         │ ✓ GA         │ ✓ GA         │
└─────────────────────┴──────────────┴──────────────┴──────────────┘
```

## Workflows

### 1. List All Available Models

Discover all models available in Microsoft Foundry catalog.

**Command Pattern:** "What models are available?"

#### Using MCP Tools

Use the `foundry_models_list` MCP tool to browse the model catalog:

```
foundry_models_list()
```

This returns all models with details including:
- Model name and publisher
- Supported versions
- License type
- Free playground availability
- Description and capabilities

#### Using Azure CLI

##### Bash
```bash
# List all available models in a specific region
az cognitiveservices model list \
  --location eastus \
  --output table

# Filter by model kind (e.g., OpenAI models)
az cognitiveservices model list \
  --location eastus \
  --query "[?kind=='OpenAI'].{Name:name, Version:version, Kind:kind}" \
  --output table

# Get detailed model information
az cognitiveservices model list \
  --location eastus \
  --output json | jq '.[] | {name: .name, version: .version, format: .format, kind: .kind}'
```

##### PowerShell
```powershell
# List models in a region
az cognitiveservices model list `
  --location eastus `
  --output table

# Filter and format
az cognitiveservices model list `
  --location eastus `
  --output json | ConvertFrom-Json |
  Where-Object {$_.kind -eq 'OpenAI'} |
  Select-Object name, version, kind
```

### 2. Check Specific Model Availability in a Region

Verify if a specific model (e.g., GPT-4o) is available in a target region.

**Command Pattern:** "Is GPT-4o available in West Europe?"

#### Bash
```bash
# Check if a specific model is available in a region
az cognitiveservices model list \
  --location westeurope \
  --query "[?contains(name, 'gpt-4o')].{Name:name, Version:version, Status:lifecycleStatus}" \
  --output table

# Check with exact model name
MODEL_NAME="gpt-4o"
REGION="westeurope"

az cognitiveservices model list \
  --location "$REGION" \
  --query "[?name=='$MODEL_NAME'].{Name:name, Version:version, Available:lifecycleStatus}" \
  --output table

# If empty result, model is not available in that region
if [ -z "$(az cognitiveservices model list --location "$REGION" --query "[?name=='$MODEL_NAME']" -o tsv)" ]; then
  echo "❌ $MODEL_NAME is NOT available in $REGION"
else
  echo "✓ $MODEL_NAME IS available in $REGION"
fi
```

#### PowerShell
```powershell
# Check model availability
$modelName = "gpt-4o"
$region = "westeurope"

$models = az cognitiveservices model list --location $region --output json | ConvertFrom-Json

$available = $models | Where-Object {$_.name -eq $modelName}

if ($available) {
    Write-Host "✓ $modelName IS available in $region" -ForegroundColor Green
    $available | Select-Object name, version, lifecycleStatus | Format-Table
} else {
    Write-Host "❌ $modelName is NOT available in $region" -ForegroundColor Red
}
```

### 3. Find All Regions Where a Model Is Available

Discover which regions support a specific model for optimal deployment planning.

**Command Pattern:** "Which regions have GPT-4o?"

#### Bash
```bash
# Define model to search for
MODEL_NAME="gpt-4o"

# List of common Azure regions for Cognitive Services
REGIONS=(
  "eastus"
  "eastus2"
  "westus"
  "westus2"
  "centralus"
  "northcentralus"
  "southcentralus"
  "westeurope"
  "northeurope"
  "uksouth"
  "francecentral"
  "germanywestcentral"
  "swedencentral"
  "switzerlandnorth"
  "norwayeast"
  "japaneast"
  "southeastasia"
  "eastasia"
  "australiaeast"
  "canadacentral"
  "brazilsouth"
  "southafricanorth"
  "uaenorth"
)

echo "Checking availability of $MODEL_NAME across regions..."
echo ""
echo "Region                  | Status"
echo "------------------------|--------"

for region in "${REGIONS[@]}"; do
  result=$(az cognitiveservices model list \
    --location "$region" \
    --query "[?name=='$MODEL_NAME']" \
    --output tsv 2>/dev/null)

  if [ -n "$result" ]; then
    printf "%-24s| ✓ Available\n" "$region"
  else
    printf "%-24s| ✗ Not available\n" "$region"
  fi
done
```

#### PowerShell
```powershell
# Check model across multiple regions
$modelName = "gpt-4o"

$regions = @(
    "eastus", "eastus2", "westus", "westus2", "centralus",
    "westeurope", "northeurope", "uksouth",
    "japaneast", "southeastasia", "australiaeast"
)

Write-Host "Checking availability of $modelName across regions...`n" -ForegroundColor Cyan

$results = foreach ($region in $regions) {
    try {
        $models = az cognitiveservices model list --location $region --output json 2>$null | ConvertFrom-Json
        $available = $models | Where-Object {$_.name -eq $modelName}

        [PSCustomObject]@{
            Region = $region
            Status = if ($available) { "✓ Available" } else { "✗ Not available" }
            Versions = if ($available) { ($available.version -join ", ") } else { "-" }
        }
    } catch {
        [PSCustomObject]@{
            Region = $region
            Status = "⚠ Error checking"
            Versions = "-"
        }
    }
}

$results | Format-Table -AutoSize

# Show only available regions
Write-Host "`nAvailable Regions:" -ForegroundColor Green
$results | Where-Object {$_.Status -eq "✓ Available"} | Select-Object -ExpandProperty Region
```

### 4. Check Available Model Versions

List all versions of a specific model to choose the right one.

**Command Pattern:** "What versions of GPT-4 are available?"

#### Bash
```bash
# List all versions of a model in a region
MODEL_NAME="gpt-4"
REGION="eastus"

az cognitiveservices model list \
  --location "$REGION" \
  --query "[?contains(name, '$MODEL_NAME')].{Model:name, Version:version, Status:lifecycleStatus, Deployment:deprecation.fineTune}" \
  --output table

# Get detailed version information
az cognitiveservices model list \
  --location "$REGION" \
  --query "[?contains(name, '$MODEL_NAME')]" \
  --output json | jq '.[] | {model: .name, version: .version, status: .lifecycleStatus, deprecated: .deprecation}'
```

**Version Comparison Table:**

| Model | Version | Status | Notes |
|-------|---------|--------|-------|
| gpt-4o | 2024-08-06 | GA | Latest, recommended |
| gpt-4o | 2024-05-13 | GA | Stable, widely available |
| gpt-4-turbo | 2024-04-09 | GA | Previous generation |
| gpt-4 | 0613 | Deprecated | Legacy, use gpt-4o instead |

### 5. Check SKU and Capacity Availability

Verify what SKUs and capacity are available before creating a deployment.

**Command Pattern:** "What capacity can I deploy in this region?"

#### Bash
```bash
# Check available SKUs for Cognitive Services in a region
az cognitiveservices account list-skus \
  --kind CognitiveServices \
  --location eastus \
  --output table

# Check specific resource SKU availability
az cognitiveservices account list-skus \
  --kind CognitiveServices \
  --location eastus \
  --query "[].{SKU:name, Tier:tier, Kind:kind, ResourceType:resourceType}" \
  --output table
```

#### PowerShell
```powershell
# Check SKU availability
az cognitiveservices account list-skus `
  --kind CognitiveServices `
  --location eastus `
  --output json | ConvertFrom-Json |
  Select-Object name, tier, resourceType |
  Format-Table -AutoSize
```

**SKU Types:**

| SKU | Description | Use Case |
|-----|-------------|----------|
| **S0** | Standard tier | Production workloads |
| **S1** | Premium tier | High-throughput applications |
| **F0** | Free tier | Development and testing |

### 6. Validate Deployment Prerequisites

Check all prerequisites before attempting to deploy a model.

**Command Pattern:** "Can I deploy this model successfully?"

#### Pre-Deployment Checklist

```bash
#!/bin/bash
# Pre-deployment validation script

MODEL_NAME="gpt-4o"
MODEL_VERSION="2024-05-13"
REGION="eastus"
RESOURCE_GROUP="my-rg"
RESOURCE_NAME="my-foundry"

echo "=== Pre-Deployment Validation ==="
echo ""

# 1. Check model availability
echo "1. Checking if $MODEL_NAME is available in $REGION..."
MODEL_CHECK=$(az cognitiveservices model list \
  --location "$REGION" \
  --query "[?name=='$MODEL_NAME' && version=='$MODEL_VERSION']" \
  --output tsv)

if [ -n "$MODEL_CHECK" ]; then
  echo "   ✓ Model available"
else
  echo "   ✗ Model NOT available in this region"
  exit 1
fi

# 2. Check resource exists
echo "2. Checking if Foundry resource exists..."
RESOURCE_CHECK=$(az cognitiveservices account show \
  --name "$RESOURCE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "name" \
  --output tsv 2>/dev/null)

if [ -n "$RESOURCE_CHECK" ]; then
  echo "   ✓ Resource exists"
else
  echo "   ✗ Resource does not exist"
  exit 1
fi

# 3. Check current quota usage
echo "3. Checking quota availability..."
QUOTA_USAGE=$(az cognitiveservices usage list \
  --name "$RESOURCE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name.value=='TokensPerMinute'].{Current:currentValue, Limit:limit}" \
  --output json)

echo "   Current quota usage: $QUOTA_USAGE"

# 4. Check permissions
echo "4. Checking RBAC permissions..."
USER_ID=$(az ad signed-in-user show --query id -o tsv)
ROLE_CHECK=$(az role assignment list \
  --assignee "$USER_ID" \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$RESOURCE_NAME" \
  --query "[?roleDefinitionName=='Cognitive Services Contributor' || roleDefinitionName=='Owner' || roleDefinitionName=='Azure AI Owner']" \
  --output tsv)

if [ -n "$ROLE_CHECK" ]; then
  echo "   ✓ User has required permissions"
else
  echo "   ⚠ User may lack deployment permissions"
fi

echo ""
echo "=== Validation Complete ==="
echo "Ready to deploy $MODEL_NAME version $MODEL_VERSION"
```

### 7. Compare Models Across Regions

Compare availability and features of multiple models across regions for optimal selection.

**Command Pattern:** "Compare GPT-4o vs GPT-4 Turbo availability"

#### Bash
```bash
# Compare two models across key regions
MODEL_1="gpt-4o"
MODEL_2="gpt-4-turbo"
REGIONS=("eastus" "westeurope" "southeastasia")

echo "Model Availability Comparison"
echo "=============================="
printf "%-20s" "Region"
printf "| %-15s" "$MODEL_1"
printf "| %-15s\n" "$MODEL_2"
echo "---------------------+----------------+----------------"

for region in "${REGIONS[@]}"; do
  printf "%-20s" "$region"

  # Check model 1
  check1=$(az cognitiveservices model list --location "$region" --query "[?name=='$MODEL_1']" -o tsv 2>/dev/null)
  if [ -n "$check1" ]; then
    printf "| %-15s" "✓ Available"
  else
    printf "| %-15s" "✗ Not available"
  fi

  # Check model 2
  check2=$(az cognitiveservices model list --location "$region" --query "[?name=='$MODEL_2']" -o tsv 2>/dev/null)
  if [ -n "$check2" ]; then
    printf "| %-15s\n" "✓ Available"
  else
    printf "| %-15s\n" "✗ Not available"
  fi
done
```

## Regional Capacity Considerations

### High-Demand Regions

Some regions experience higher demand and may have capacity constraints:

| Region | Demand Level | Notes |
|--------|--------------|-------|
| **East US** | Very High | Most popular, may hit capacity limits |
| **West Europe** | High | Popular for European workloads |
| **Southeast Asia** | Medium | Growing demand |
| **Japan East** | Medium | Regional preference |
| **Australia East** | Low-Medium | Good availability |

### Capacity Planning Strategies

1. **Primary + Failover Regions**
   ```
   Primary: East US (highest performance)
   Failover: East US 2 or Central US
   ```

2. **Geographic Distribution**
   ```
   Americas: East US
   Europe: West Europe
   Asia-Pacific: Southeast Asia
   ```

3. **Load Balancing**
   - Deploy identical models in 2-3 regions
   - Distribute requests geographically
   - Implement automatic failover

## Common Issues and Resolutions

| Issue | Cause | Resolution |
|-------|-------|------------|
| "Model not found" error | Model not available in region | Check availability with CLI, try different region |
| Deployment stuck in "Creating" | Region at capacity | Wait or deploy to alternative region |
| Specific version unavailable | Version sunset or preview only | Use latest GA version or check preview regions |
| "SKU not available" error | Requested SKU not in region | Check SKU availability, use Standard (S0) |
| Inconsistent availability | Regional rollout in progress | Check Azure updates, wait for GA announcement |
| Free tier not available | Region doesn't support F0 | Use paid tier or deploy to region with F0 support |

## Best Practices

### Region Selection

1. **Prioritize by Latency**
   - Choose region closest to users
   - Test latency from your application

2. **Check Capacity Before Commit**
   ```bash
   # Test deploy with minimal capacity
   az cognitiveservices account deployment create \
     --name <resource> \
     --resource-group <rg> \
     --deployment-name test-deploy \
     --model-name gpt-4o \
     --model-version "2024-05-13" \
     --model-format OpenAI \
     --sku-capacity 1 \
     --sku-name Standard
   ```

3. **Plan for Multi-Region**
   - Always have a failover region
   - Verify model availability in both regions
   - Test failover before production

### Model Version Strategy

1. **Use GA Versions for Production**
   - Preview versions have limited availability
   - GA versions are stable across regions

2. **Monitor Version Deprecation**
   ```bash
   # Check deprecation status
   az cognitiveservices model list \
     --location eastus \
     --query "[?deprecation!=null].{Model:name, Version:version, Deprecation:deprecation}" \
     --output table
   ```

3. **Stay Updated**
   - Subscribe to Azure updates
   - Review monthly "What's New" announcements
   - Plan migrations before deprecation dates

### Automation

```python
# Python script to check model availability
from azure.mgmt.cognitiveservices import CognitiveServicesManagementClient
from azure.identity import DefaultAzureCredential

def check_model_availability(subscription_id, model_name, regions):
    """Check if a model is available across multiple regions."""
    credential = DefaultAzureCredential()
    client = CognitiveServicesManagementClient(credential, subscription_id)

    results = {}
    for region in regions:
        try:
            models = client.resource_skus.list(location=region)
            available = any(m.name == model_name for m in models)
            results[region] = "✓ Available" if available else "✗ Not available"
        except Exception as e:
            results[region] = f"⚠ Error: {str(e)}"

    return results

# Usage
regions = ["eastus", "westeurope", "southeastasia"]
availability = check_model_availability("your-subscription-id", "gpt-4o", regions)

for region, status in availability.items():
    print(f"{region:20} | {status}")
```

## Additional Resources

- [Azure OpenAI Model Availability](https://learn.microsoft.com/azure/cognitive-services/openai/concepts/models)
- [Azure Regions and Availability Zones](https://azure.microsoft.com/global-infrastructure/geographies/)
- [Cognitive Services Regions](https://learn.microsoft.com/azure/cognitive-services/cognitive-services-apis-create-account-cli)
- [Model Lifecycle and Deprecation](https://learn.microsoft.com/azure/cognitive-services/openai/concepts/model-retirements)
- [Azure OpenAI Service Quotas](https://learn.microsoft.com/azure/cognitive-services/openai/quotas-limits)
