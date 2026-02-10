# Foundry Resource Creation Workflows

This file contains detailed workflows for creating Azure AI Services multi-service resources.

## 1. Create Resource Group

**Command Pattern:** "Create a resource group for my Foundry resources"

Creates an Azure resource group to contain Foundry resources.

### Steps

**Step 1: List available Azure regions**

```bash
az account list-locations --query "[].{Region:name}" --out table
```

This shows all Azure regions. Common regions:
- `eastus`, `eastus2` - US East Coast
- `westus`, `westus2`, `westus3` - US West Coast
- `centralus` - US Central
- `westeurope`, `northeurope` - Europe
- `southeastasia`, `eastasia` - Asia Pacific

**Step 2: Create resource group**

```bash
az group create \
  --name <resource-group-name> \
  --location <location>
```

**Parameters:**
- `--name`: Unique resource group name
- `--location`: Azure region from step 1

**Step 3: Verify creation**

```bash
az group show --name <resource-group-name>
```

**Expected output:**
- `provisioningState: "Succeeded"`
- Resource group ID
- Location information

### Example

```bash
# List regions
az account list-locations --query "[].{Region:name}" --out table

# Create resource group in West US 2
az group create \
  --name rg-ai-services \
  --location westus2

# Verify
az group show --name rg-ai-services
```

---

## 2. Create Foundry Resource

**Command Pattern:** "Create a new Azure AI Services resource"

Creates an Azure AI Services multi-service resource (kind: AIServices).

### Steps

**Step 1: Verify prerequisites**

```bash
# Check Azure CLI version (need 2.0+)
az --version

# Verify authentication
az account show

# Check resource provider registration status
az provider show --namespace Microsoft.CognitiveServices --query "registrationState"
```

If provider not registered, see [Workflow #4](#4-register-resource-provider).

**Step 2: Create Foundry resource**

```bash
az cognitiveservices account create \
  --name <resource-name> \
  --resource-group <rg> \
  --kind AIServices \
  --sku S0 \
  --location <location> \
  --yes
```

**Parameters:**
- `--name`: Unique resource name (globally unique across Azure)
- `--resource-group`: Existing resource group name
- `--kind`: **Must be `AIServices`** for multi-service resource
- `--sku`: Pricing tier (S0 = Standard, F0 = Free)
- `--location`: Azure region (should match resource group)
- `--yes`: Auto-accept terms without prompting

**What gets created:**
- Azure AI Services account
- Single endpoint for multiple AI services
- Keys for authentication
- Default network and security settings

**Step 3: Verify resource creation**

```bash
# Get resource details
az cognitiveservices account show \
  --name <resource-name> \
  --resource-group <rg>

# Get endpoint and keys
az cognitiveservices account show \
  --name <resource-name> \
  --resource-group <rg> \
  --query "{Name:name, Endpoint:properties.endpoint, Location:location, Kind:kind, SKU:sku.name}"
```

**Expected output:**
- `provisioningState: "Succeeded"`
- Endpoint URL (e.g., `https://<region>.api.cognitive.microsoft.com/`)
- SKU details
- Kind: `AIServices`

**Step 4: Get access keys**

```bash
az cognitiveservices account keys list \
  --name <resource-name> \
  --resource-group <rg>
```

This returns `key1` and `key2` for API authentication.

### Example

```bash
# Create Standard tier Foundry resource
az cognitiveservices account create \
  --name my-foundry-resource \
  --resource-group rg-ai-services \
  --kind AIServices \
  --sku S0 \
  --location westus2 \
  --yes

# Verify creation
az cognitiveservices account show \
  --name my-foundry-resource \
  --resource-group rg-ai-services \
  --query "{Name:name, Endpoint:properties.endpoint, Kind:kind, State:properties.provisioningState}"

# Get keys
az cognitiveservices account keys list \
  --name my-foundry-resource \
  --resource-group rg-ai-services
```

### SKU Comparison

| SKU | Name | Features | Use Case |
|-----|------|----------|----------|
| F0 | Free | Limited transactions, single region | Development, testing |
| S0 | Standard | Full features, pay-per-use | Production workloads |

---

## 3. Monitor Resource Usage

**Command Pattern:** "Check usage for my Foundry resource"

Monitors API call usage and quotas for the Foundry resource.

### Steps

**Step 1: Check usage statistics**

```bash
az cognitiveservices account list-usage \
  --name <resource-name> \
  --resource-group <rg>
```

This returns usage metrics including:
- Current usage counts
- Quota limits
- Usage period

**Step 2: Check with subscription context**

```bash
az cognitiveservices account list-usage \
  --name <resource-name> \
  --resource-group <rg> \
  --subscription <subscription-name-or-id>
```

Use when managing multiple subscriptions.

**Step 3: Interpret results**

Output shows:
- `currentValue`: Current usage
- `limit`: Maximum allowed
- `name`: Metric name
- `unit`: Unit of measurement

### Example

```bash
# Check usage
az cognitiveservices account list-usage \
  --name my-foundry-resource \
  --resource-group rg-ai-services

# Check with subscription
az cognitiveservices account list-usage \
  --name my-foundry-resource \
  --resource-group rg-ai-services \
  --subscription my-subscription-id
```

**Sample output:**
```json
[
  {
    "currentValue": 1523,
    "limit": 10000,
    "name": {
      "value": "TotalCalls",
      "localizedValue": "Total Calls"
    },
    "unit": "Count"
  }
]
```

---

## 4. Register Resource Provider

**Command Pattern:** "Register Cognitive Services provider"

Registers the Microsoft.CognitiveServices resource provider for the subscription.

### When Needed

Required when:
- First time creating Cognitive Services in subscription
- Error: `ResourceProviderNotRegistered`
- Insufficient permissions during resource creation

### Steps

**Step 1: Check registration status**

```bash
az provider show \
  --namespace Microsoft.CognitiveServices \
  --query "registrationState"
```

Possible states:
- `Registered`: Ready to use
- `NotRegistered`: Needs registration
- `Registering`: Registration in progress

**Step 2: Register provider**

```bash
az provider register --namespace Microsoft.CognitiveServices
```

**Step 3: Wait for registration**

Registration typically takes 1-2 minutes. Check status:

```bash
az provider show \
  --namespace Microsoft.CognitiveServices \
  --query "registrationState"
```

Wait until state is `Registered`.

**Step 4: Verify registration**

```bash
az provider list --query "[?namespace=='Microsoft.CognitiveServices']"
```

### Example

```bash
# Check current status
az provider show --namespace Microsoft.CognitiveServices --query "registrationState"

# Register if needed
az provider register --namespace Microsoft.CognitiveServices

# Wait and check
sleep 60
az provider show --namespace Microsoft.CognitiveServices --query "registrationState"
```

### Required Permissions

- Subscription Owner or Contributor role
- Custom role with `Microsoft.*/register/action` permission

> **Need permission help?** Use `microsoft-foundry:rbac` skill to manage roles.

---

## Common Patterns

### Pattern A: Quick Setup

Complete setup in one go:

```bash
# Variables
RG="rg-ai-services"
LOCATION="westus2"
RESOURCE_NAME="my-foundry-resource"

# Create resource group
az group create --name $RG --location $LOCATION

# Create Foundry resource
az cognitiveservices account create \
  --name $RESOURCE_NAME \
  --resource-group $RG \
  --kind AIServices \
  --sku S0 \
  --location $LOCATION \
  --yes

# Get endpoint and keys
echo "Resource created successfully!"
az cognitiveservices account show \
  --name $RESOURCE_NAME \
  --resource-group $RG \
  --query "{Endpoint:properties.endpoint, Location:location}"

az cognitiveservices account keys list \
  --name $RESOURCE_NAME \
  --resource-group $RG
```

### Pattern B: Multi-Region Setup

Create resources in multiple regions:

```bash
# Variables
RG="rg-ai-services"
REGIONS=("eastus" "westus2" "westeurope")

# Create resource group
az group create --name $RG --location eastus

# Create resources in each region
for REGION in "${REGIONS[@]}"; do
  RESOURCE_NAME="foundry-${REGION}"
  echo "Creating resource in $REGION..."

  az cognitiveservices account create \
    --name $RESOURCE_NAME \
    --resource-group $RG \
    --kind AIServices \
    --sku S0 \
    --location $REGION \
    --yes

  echo "Resource $RESOURCE_NAME created in $REGION"
done

# List all resources
az cognitiveservices account list --resource-group $RG --output table
```

---

## Troubleshooting

### Resource Creation Fails

**Error:** `ResourceProviderNotRegistered`

**Solution:** Run [Workflow #4](#4-register-resource-provider) to register provider.

**Error:** `InsufficientPermissions`

**Solution:**
```bash
# Check your role assignments
az role assignment list --assignee <your-user-id> --subscription <subscription-id>

# You need one of: Contributor, Owner, or custom role with Microsoft.CognitiveServices/accounts/write
```

Use `microsoft-foundry:rbac` skill to manage permissions.

**Error:** `LocationNotAvailableForResourceType`

**Solution:**
```bash
# List available regions for Cognitive Services
az provider show --namespace Microsoft.CognitiveServices \
  --query "resourceTypes[?resourceType=='accounts'].locations" --out table

# Choose different region from the list
```

**Error:** `ResourceNameNotAvailable`

**Solution:**
Resource name must be globally unique. Try:
```bash
# Use different name with unique suffix
UNIQUE_SUFFIX=$(date +%s)
az cognitiveservices account create \
  --name "foundry-${UNIQUE_SUFFIX}" \
  --resource-group <rg> \
  --kind AIServices \
  --sku S0 \
  --location <location> \
  --yes
```

### Resource Shows as Failed

**Check provisioning state:**
```bash
az cognitiveservices account show \
  --name <resource-name> \
  --resource-group <rg> \
  --query "properties.provisioningState"
```

If `Failed`, delete and recreate:
```bash
# Delete failed resource
az cognitiveservices account delete \
  --name <resource-name> \
  --resource-group <rg>

# Recreate
az cognitiveservices account create \
  --name <resource-name> \
  --resource-group <rg> \
  --kind AIServices \
  --sku S0 \
  --location <location> \
  --yes
```

### Cannot Access Keys

**Error:** `AuthorizationFailed` when listing keys

**Solution:**
You need `Cognitive Services User` or higher role on the resource.

Use `microsoft-foundry:rbac` skill to grant appropriate permissions.
