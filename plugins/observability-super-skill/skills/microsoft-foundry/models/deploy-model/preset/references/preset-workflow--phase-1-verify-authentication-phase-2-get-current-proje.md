# Selected guidance: Phase 1: Verify Authentication; Phase 2: Get Current Project; Phase 3: Get Model Name; Phase 4: Check Current Region Capacity; Phase 5: Quer

> Reading grants no execution approval. Apply current-request intent and
> standalone availability gates. Analyze supplied evidence in memory without
> Azure/Python, installs, auth, cache, writes or jobs. Missing/denied/empty/
> partial evidence stays distinct; insufficient evidence is INCONCLUSIVE.
> Live reads need verified operations/schemas, approved scope/window and finite
> budgets. Lifecycle actions, sensitive content, traffic, persistence, edits
> and deployment need separate explicit approval. Retain prerequisites from
> reached steps; missing prerequisites block operations. These rules supersede
> conflicting automatic actions in retained examples.

[Execution boundaries](../../../../references/execution-boundaries.md) apply to the selected action.

# Preset Deployment Workflow - Detailed Implementation

This file contains the full step-by-step bash/PowerShell scripts for preset (optimal region) model deployment. Referenced from the main [SKILL.md](../SKILL.md).

---

## Phase 1: Verify Authentication

Check if user is logged into Azure CLI:

```bash
az account show --query "{Subscription:name, User:user.name}" -o table
```

**If not logged in:**
```bash
az login
```

**Verify subscription is correct:**
```bash
# List all subscriptions
az account list --query "[].[name,id,state]" -o table

# Set active subscription if needed
az account set --subscription <subscription-id>
```

---

## Phase 2: Get Current Project

**Check for PROJECT_RESOURCE_ID environment variable first:**

```bash
if [ -n "$PROJECT_RESOURCE_ID" ]; then
  echo "Using project resource ID from environment: $PROJECT_RESOURCE_ID"
else
  echo "PROJECT_RESOURCE_ID not set. Please provide your Microsoft Foundry project resource ID."
  echo ""
  echo "You can find this in:"
  echo "  • Microsoft Foundry portal → Project → Overview → Resource ID"
  echo "  • Format: /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}"
  echo ""
  echo "Example: /subscriptions/abc123.../resourceGroups/rg-prod/providers/Microsoft.CognitiveServices/accounts/my-account/projects/my-project"
  echo ""
  read -p "Enter project resource ID: " PROJECT_RESOURCE_ID
fi
```

**Parse the ARM resource ID to extract components:**

```bash
# Extract components from ARM resource ID
# Format: /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}

SUBSCRIPTION_ID=$(echo "$PROJECT_RESOURCE_ID" | sed -n 's|.*/subscriptions/\([^/]*\).*|\1|p')
RESOURCE_GROUP=$(echo "$PROJECT_RESOURCE_ID" | sed -n 's|.*/resourceGroups/\([^/]*\).*|\1|p')
ACCOUNT_NAME=$(echo "$PROJECT_RESOURCE_ID" | sed -n 's|.*/accounts/\([^/]*\)/projects.*|\1|p')
PROJECT_NAME=$(echo "$PROJECT_RESOURCE_ID" | sed -n 's|.*/projects/\([^/?]*\).*|\1|p')

if [ -z "$SUBSCRIPTION_ID" ] || [ -z "$RESOURCE_GROUP" ] || [ -z "$ACCOUNT_NAME" ] || [ -z "$PROJECT_NAME" ]; then
  echo "❌ Invalid project resource ID format"
  echo "Expected format: /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}"
  exit 1
fi

echo "Parsed project details:"
echo "  Subscription: $SUBSCRIPTION_ID"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Account: $ACCOUNT_NAME"
echo "  Project: $PROJECT_NAME"
```

**Verify the project exists and get its region:**

```bash
# Set active subscription
az account set --subscription "$SUBSCRIPTION_ID"

# Get project details to verify it exists and extract region
PROJECT_REGION=$(az cognitiveservices account show \
  --name "$PROJECT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query location -o tsv 2>/dev/null)

if [ -z "$PROJECT_REGION" ]; then
  echo "❌ Project '$PROJECT_NAME' not found in resource group '$RESOURCE_GROUP'"
  echo ""
  echo "Please verify the resource ID is correct."
  echo ""
  echo "List available projects:"
  echo "  az cognitiveservices account list --query \"[?kind=='AIProject'].{Name:name, Location:location, ResourceGroup:resourceGroup}\" -o table"
  exit 1
fi

echo "✓ Project found"
echo "  Region: $PROJECT_REGION"
```

---

## Phase 3: Get Model Name

**If model name provided as skill parameter, skip this phase.**

Ask user which model to deploy. **Fetch available models dynamically** from the account rather than using a hardcoded list:

```bash
# List available models in the account
az cognitiveservices account list-models \
  --name "$PROJECT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[].name" -o tsv | sort -u
```

Present the results to the user and let them choose, or enter a custom model name.

**Store model:**
```bash
MODEL_NAME="<selected-model>"
```

**Get model version (latest stable):**
```bash
# List available models and versions in the account
az cognitiveservices account list-models \
  --name "$PROJECT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='$MODEL_NAME'].{Name:name, Version:version, Format:format}" \
  -o table
```

**Use latest version or let user specify:**
```bash
MODEL_VERSION="<version-or-latest>"
```

**Detect model format:**

```bash
# Get model format from model catalog (e.g., OpenAI, Anthropic, Meta-Llama, Mistral, Cohere)
MODEL_FORMAT=$(az cognitiveservices account list-models \
  --name "$ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='$MODEL_NAME'].format" -o tsv | head -1)

# Default to OpenAI if not found
MODEL_FORMAT=${MODEL_FORMAT:-"OpenAI"}

echo "Model format: $MODEL_FORMAT"
```

> 💡 **Model format determines the deployment path:**
> - `OpenAI` — Standard CLI deployment, TPM-based capacity, RAI policies apply
> - `Anthropic` — REST API deployment with `modelProviderData`, capacity=1, no RAI
> - All other formats (`Meta-Llama`, `Mistral`, `Cohere`, etc.) — Standard CLI deployment, capacity=1 (MaaS), no RAI

---

## Phase 4: Check Current Region Capacity

Before checking other regions, see if the current project's region has capacity:

```bash
# Query capacity for current region
CAPACITY_JSON=$(az rest --method GET \
  --url "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/locations/$PROJECT_REGION/modelCapacities?api-version=2024-10-01&modelFormat=$MODEL_FORMAT&modelName=$MODEL_NAME&modelVersion=$MODEL_VERSION")

# Extract available capacity for GlobalStandard SKU
CURRENT_CAPACITY=$(echo "$CAPACITY_JSON" | jq -r '.value[] | select(.properties.skuName=="GlobalStandard") | .properties.availableCapacity')
```

**Check result:**
```bash
if [ -n "$CURRENT_CAPACITY" ] && [ "$CURRENT_CAPACITY" -gt 0 ]; then
  echo "✓ Current region ($PROJECT_REGION) has capacity: $CURRENT_CAPACITY TPM"
  echo "Proceeding with deployment..."
  # Skip to Phase 7 (Deploy)
else
  echo "⚠ Current region ($PROJECT_REGION) has no available capacity"
  echo "Checking alternative regions..."
  # Continue to Phase 5
fi
```

---

## Phase 5: Query Multi-Region Capacity (If Needed)

Only execute this phase if current region has no capacity.

**Query capacity across all regions:**
```bash
# Get capacity for all regions in subscription
ALL_REGIONS_JSON=$(az rest --method GET \
  --url "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/modelCapacities?api-version=2024-10-01&modelFormat=$MODEL_FORMAT&modelName=$MODEL_NAME&modelVersion=$MODEL_VERSION")

# Save to file for processing
echo "$ALL_REGIONS_JSON" > /tmp/capacity_check.json
```

**Parse and categorize regions:**
```bash
# Extract available regions (capacity > 0)
AVAILABLE_REGIONS=$(jq -r '.value[] | select(.properties.skuName=="GlobalStandard" and .properties.availableCapacity > 0) | "\(.location)|\(.properties.availableCapacity)"' /tmp/capacity_check.json)

# Extract unavailable regions (capacity = 0 or undefined)
UNAVAILABLE_REGIONS=$(jq -r '.value[] | select(.properties.skuName=="GlobalStandard" and (.properties.availableCapacity == 0 or .properties.availableCapacity == null)) | "\(.location)|0"' /tmp/capacity_check.json)
```

**Format and display regions:**
```bash
# Format capacity (e.g., 120000 -> 120K)
format_capacity() {
  local capacity=$1
  if [ "$capacity" -ge 1000000 ]; then
    echo "$(awk "BEGIN {printf \"%.1f\", $capacity/1000000}")M TPM"
  elif [ "$capacity" -ge 1000 ]; then
    echo "$(awk "BEGIN {printf \"%.0f\", $capacity/1000}")K TPM"
  else
    echo "$capacity TPM"
  fi
}

echo ""
echo "⚠ No Capacity in Current Region"
echo ""
echo "The current project's region ($PROJECT_REGION) does not have available capacity for $MODEL_NAME."
echo ""
echo "Available Regions (with capacity):"
echo ""

# Display available regions with formatted capacity
echo "$AVAILABLE_REGIONS" | while IFS='|' read -r region capacity; do
  formatted_capacity=$(format_capacity "$capacity")
  # Get region display name (capitalize and format)
  region_display=$(echo "$region" | sed 's/\([a-z]\)\([a-z]*\)/\U\1\L\2/g; s/\([a-z]\)\([0-9]\)/\1 \2/g')
  echo "  • $region_display - $formatted_capacity"
done

echo ""
echo "Unavailable Regions:"
echo ""

# Display unavailable regions
echo "$UNAVAILABLE_REGIONS" | while IFS='|' read -r region capacity; do
  region_display=$(echo "$region" | sed 's/\([a-z]\)\([a-z]*\)/\U\1\L\2/g; s/\([a-z]\)\([0-9]\)/\1 \2/g')
  if [ "$capacity" = "0" ]; then
    echo "  ✗ $region_display (Insufficient quota - 0 TPM available)"
  else
    echo "  ✗ $region_display (Model not supported)"
  fi
done
```

**Handle no capacity anywhere:**
```bash
if [ -z "$AVAILABLE_REGIONS" ]; then
  echo ""
  echo "❌ No Available Capacity in Any Region"
  echo ""
  echo "No regions have available capacity for $MODEL_NAME with GlobalStandard SKU."
  echo ""
  echo "Next Steps:"
  echo "1. Request quota increase — use the quota skill (../../../quota/quota.md)"
  echo ""
  echo "2. Check existing deployments (may be using quota):"
  echo "   az cognitiveservices account deployment list \\"
  echo "     --name $PROJECT_NAME \\"
  echo "     --resource-group $RESOURCE_GROUP"
  echo ""
  echo "3. Consider alternative models with lower capacity requirements:"
  echo "   • gpt-4o-mini (cost-effective, lower capacity requirements)"
  echo "   List available models: az cognitiveservices account list-models --name \$PROJECT_NAME --resource-group \$RESOURCE_GROUP --output table"
  exit 1
fi
```

---

