# Selected guidance: Phase 6: Select Region and Project; Phase 7: Deploy Model; If MODEL_FORMAT is NOT "Anthropic" — Standard CLI Deployment; If MODEL_FORMAT is

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

## Phase 6: Select Region and Project

**Ask user to select region from available options.**

Example using AskUserQuestion:
- Present available regions as options
- Show capacity for each
- User selects preferred region

**Store selection:**
```bash
SELECTED_REGION="<user-selected-region>"  # e.g., "eastus2"
```

**Find projects in selected region:**
```bash
PROJECTS_IN_REGION=$(az cognitiveservices account list \
  --query "[?kind=='AIProject' && location=='$SELECTED_REGION'].{Name:name, ResourceGroup:resourceGroup}" \
  --output json)

PROJECT_COUNT=$(echo "$PROJECTS_IN_REGION" | jq '. | length')

if [ "$PROJECT_COUNT" -eq 0 ]; then
  echo "No projects found in $SELECTED_REGION"
  echo "Would you like to create a new project? (yes/no)"
  # If yes, continue to project creation
  # If no, exit or select different region
else
  echo "Projects in $SELECTED_REGION:"
  echo "$PROJECTS_IN_REGION" | jq -r '.[] | "  • \(.Name) (\(.ResourceGroup))"'
  echo ""
  echo "Select a project or create new project"
fi
```

**Option A: Use existing project**
```bash
PROJECT_NAME="<selected-project-name>"
RESOURCE_GROUP="<resource-group>"
```

**Option B: Create new project**
```bash
# Generate project name
USER_ALIAS=$(az account show --query user.name -o tsv | cut -d'@' -f1 | tr '.' '-')
RANDOM_SUFFIX=$(openssl rand -hex 2)
NEW_PROJECT_NAME="${USER_ALIAS}-aiproject-${RANDOM_SUFFIX}"

# Prompt for resource group
echo "Resource group for new project:"
echo "  1. Use existing resource group: $RESOURCE_GROUP"
echo "  2. Create new resource group"

# If existing resource group
NEW_RESOURCE_GROUP="$RESOURCE_GROUP"

# Create AI Services account (hub)
HUB_NAME="${NEW_PROJECT_NAME}-hub"

echo "Creating AI Services hub: $HUB_NAME in $SELECTED_REGION..."

az cognitiveservices account create \
  --name "$HUB_NAME" \
  --resource-group "$NEW_RESOURCE_GROUP" \
  --location "$SELECTED_REGION" \
  --kind "AIServices" \
  --sku "S0" \
  --yes

# Create Microsoft Foundry project
echo "Creating Microsoft Foundry project: $NEW_PROJECT_NAME..."

az cognitiveservices account create \
  --name "$NEW_PROJECT_NAME" \
  --resource-group "$NEW_RESOURCE_GROUP" \
  --location "$SELECTED_REGION" \
  --kind "AIProject" \
  --sku "S0" \
  --yes

echo "✓ Project created successfully"
PROJECT_NAME="$NEW_PROJECT_NAME"
RESOURCE_GROUP="$NEW_RESOURCE_GROUP"
```

---

## Phase 7: Deploy Model

**Generate unique deployment name:**

The deployment name should match the model name (e.g., "gpt-4o"), but if a deployment with that name already exists, append a numeric suffix (e.g., "gpt-4o-2", "gpt-4o-3"). This follows the same UX pattern as Microsoft Foundry portal.

Use the `generate_deployment_name` script to check existing deployments and generate a unique name:

*Bash version:*
```bash
DEPLOYMENT_NAME=$(bash scripts/generate_deployment_name.sh \
  "$ACCOUNT_NAME" \
  "$RESOURCE_GROUP" \
  "$MODEL_NAME")

echo "Generated deployment name: $DEPLOYMENT_NAME"
```

*PowerShell version:*
```powershell
$DEPLOYMENT_NAME = & .\scripts\generate_deployment_name.ps1 `
  -AccountName $ACCOUNT_NAME `
  -ResourceGroup $RESOURCE_GROUP `
  -ModelName $MODEL_NAME

Write-Host "Generated deployment name: $DEPLOYMENT_NAME"
```

**Calculate deployment capacity:**

Follow UX capacity calculation logic. For OpenAI models, use 50% of available capacity (minimum 50 TPM). For all other models (MaaS), capacity is always 1:

```bash
if [ "$MODEL_FORMAT" = "OpenAI" ]; then
  # OpenAI models: TPM-based capacity (50% of available, minimum 50)
  SELECTED_CAPACITY=$(echo "$ALL_REGIONS_JSON" | jq -r ".value[] | select(.location==\"$SELECTED_REGION\" and .properties.skuName==\"GlobalStandard\") | .properties.availableCapacity")

  if [ "$SELECTED_CAPACITY" -gt 50 ]; then
    DEPLOY_CAPACITY=$((SELECTED_CAPACITY / 2))
    if [ "$DEPLOY_CAPACITY" -lt 50 ]; then
      DEPLOY_CAPACITY=50
    fi
  else
    DEPLOY_CAPACITY=$SELECTED_CAPACITY
  fi

  echo "Deploying with capacity: $DEPLOY_CAPACITY TPM (50% of available: $SELECTED_CAPACITY TPM)"
else
  # Non-OpenAI models (MaaS): capacity is always 1
  DEPLOY_CAPACITY=1
  echo "MaaS model — deploying with capacity: 1 (pay-per-token billing)"
fi
```

### If MODEL_FORMAT is NOT "Anthropic" — Standard CLI Deployment

> 💡 **Note:** The Azure CLI supports all non-Anthropic model formats directly.

*Bash version:*
```bash
echo "Creating deployment..."

az cognitiveservices account deployment create \
  --name "$ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --deployment-name "$DEPLOYMENT_NAME" \
  --model-name "$MODEL_NAME" \
  --model-version "$MODEL_VERSION" \
  --model-format "$MODEL_FORMAT" \
  --sku-name "GlobalStandard" \
  --sku-capacity "$DEPLOY_CAPACITY"
```

*PowerShell version:*
```powershell
Write-Host "Creating deployment..."

az cognitiveservices account deployment create `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --deployment-name $DEPLOYMENT_NAME `
  --model-name $MODEL_NAME `
  --model-version $MODEL_VERSION `
  --model-format $MODEL_FORMAT `
  --sku-name "GlobalStandard" `
  --sku-capacity $DEPLOY_CAPACITY
```

> 💡 **Note:** For non-OpenAI MaaS models (Meta-Llama, Mistral, Cohere, etc.), `$DEPLOY_CAPACITY` is `1` (set in capacity calculation above).

### If MODEL_FORMAT is "Anthropic" — REST API Deployment with modelProviderData

The Azure CLI does not support `--model-provider-data`. You must use the ARM REST API directly.

**Step 1: Prompt user to select industry**

Present the following list and ask the user to choose one:

```
 1. None                    (API value: none)
 2. Biotechnology           (API value: biotechnology)
 3. Consulting              (API value: consulting)
 4. Education               (API value: education)
 5. Finance                 (API value: finance)
 6. Food & Beverage         (API value: food_and_beverage)
 7. Government              (API value: government)
 8. Healthcare              (API value: healthcare)
 9. Insurance               (API value: insurance)
10. Law                     (API value: law)
11. Manufacturing           (API value: manufacturing)
12. Media                   (API value: media)
13. Nonprofit               (API value: nonprofit)
14. Technology              (API value: technology)
15. Telecommunications      (API value: telecommunications)
16. Sport & Recreation      (API value: sport_and_recreation)
17. Real Estate             (API value: real_estate)
18. Retail                  (API value: retail)
19. Other                   (API value: other)
```

> ⚠️ **Do NOT pick a default industry or hardcode a value. Always ask the user.** This is required by Anthropic's terms of service. The industry list is static — there is no REST API that provides it.

Store selection as `SELECTED_INDUSTRY` (use the API value, e.g., `technology`).

**Step 2: Fetch tenant info (country code and organization name)**

```bash
TENANT_INFO=$(az rest --method GET \
  --url "https://management.azure.com/tenants?api-version=2024-11-01" \
  --query "value[0].{countryCode:countryCode, displayName:displayName}" -o json)

COUNTRY_CODE=$(echo "$TENANT_INFO" | jq -r '.countryCode')
ORG_NAME=$(echo "$TENANT_INFO" | jq -r '.displayName')
```

*PowerShell version:*
```powershell
$tenantInfo = az rest --method GET `
  --url "https://management.azure.com/tenants?api-version=2024-11-01" `
  --query "value[0].{countryCode:countryCode, displayName:displayName}" -o json | ConvertFrom-Json

$countryCode = $tenantInfo.countryCode
$orgName = $tenantInfo.displayName
```

**Step 3: Deploy via ARM REST API**

*Bash version:*
```bash
echo "Creating Anthropic model deployment via REST API..."

az rest --method PUT \
  --url "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$ACCOUNT_NAME/deployments/$DEPLOYMENT_NAME?api-version=2024-10-01" \
  --body "{
    \"sku\": {
      \"name\": \"GlobalStandard\",
      \"capacity\": 1
    },
    \"properties\": {
      \"model\": {
        \"format\": \"Anthropic\",
        \"name\": \"$MODEL_NAME\",
        \"version\": \"$MODEL_VERSION\"
      },
      \"modelProviderData\": {
        \"industry\": \"$SELECTED_INDUSTRY\",
        \"countryCode\": \"$COUNTRY_CODE\",
        \"organizationName\": \"$ORG_NAME\"
      }
    }
  }"
```

*PowerShell version:*
```powershell
Write-Host "Creating Anthropic model deployment via REST API..."

$body = @{
    sku = @{
        name = "GlobalStandard"
        capacity = 1
    }
    properties = @{
        model = @{
            format = "Anthropic"
            name = $MODEL_NAME
            version = $MODEL_VERSION
        }
        modelProviderData = @{
            industry = $SELECTED_INDUSTRY
            countryCode = $countryCode
            organizationName = $orgName
        }
    }
} | ConvertTo-Json -Depth 5

az rest --method PUT `
  --url "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$ACCOUNT_NAME/deployments/${DEPLOYMENT_NAME}?api-version=2024-10-01" `
  --body $body
```

> 💡 **Note:** Anthropic models use `capacity: 1` (MaaS billing model), not TPM-based capacity.

**Monitor deployment progress:**
```bash
echo "Monitoring deployment status..."

MAX_WAIT=300  # 5 minutes
ELAPSED=0
INTERVAL=10

while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(az cognitiveservices account deployment show \
    --name "$ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --deployment-name "$DEPLOYMENT_NAME" \
    --query "properties.provisioningState" -o tsv 2>/dev/null)

  case "$STATUS" in
    "Succeeded")
      echo "✓ Deployment successful!"
      break
      ;;
    "Failed")
      echo "❌ Deployment failed"
      # Get error details
      az cognitiveservices account deployment show \
        --name "$ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --deployment-name "$DEPLOYMENT_NAME" \
        --query "properties"
      exit 1
      ;;
    "Creating"|"Accepted"|"Running")
      echo "Status: $STATUS... (${ELAPSED}s elapsed)"
      sleep $INTERVAL
      ELAPSED=$((ELAPSED + INTERVAL))
      ;;
    *)
      echo "Unknown status: $STATUS"
      sleep $INTERVAL
      ELAPSED=$((ELAPSED + INTERVAL))
      ;;
  esac
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "⚠ Deployment timeout after ${MAX_WAIT}s"
  echo "Check status manually:"
  echo "  az cognitiveservices account deployment show \\"
  echo "    --name $ACCOUNT_NAME \\"
  echo "    --resource-group $RESOURCE_GROUP \\"
  echo "    --deployment-name $DEPLOYMENT_NAME"
  exit 1
fi
```

---

