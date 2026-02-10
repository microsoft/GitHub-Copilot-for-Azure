---
name: microsoft-foundry:resource/create
description: |
  Create Azure AI Services multi-service resource (Foundry resource) using Azure CLI.
  USE FOR: create Foundry resource, new AI Services resource, create multi-service resource, provision Azure AI Services, AIServices kind resource, register resource provider, enable Cognitive Services, setup AI Services account, create resource group for Foundry.
  DO NOT USE FOR: creating ML workspace hubs (use microsoft-foundry:project/create), deploying models (use microsoft-foundry:models/deploy), managing permissions (use microsoft-foundry:rbac), monitoring resource usage (use microsoft-foundry:quota).
compatibility:
  required:
    - azure-cli: ">=2.0"
  optional:
    - powershell: ">=7.0"
    - azure-portal: "any"
---

# Create Foundry Resource

This sub-skill orchestrates creation of Azure AI Services multi-service resources using Azure CLI.

> **Important:** All resource creation operations are **control plane (management)** operations. Use **Azure CLI commands** as the primary method.

> **Note:** For monitoring resource usage and quotas, use the `microsoft-foundry:quota` skill.

## Quick Reference

| Property | Value |
|----------|-------|
| **Classification** | WORKFLOW SKILL |
| **Operation Type** | Control Plane (Management) |
| **Primary Method** | Azure CLI: `az cognitiveservices account create` |
| **Resource Type** | `Microsoft.CognitiveServices/accounts` (kind: `AIServices`) |
| **Resource Kind** | `AIServices` (multi-service) |

## When to Use

Use this sub-skill when you need to:

- **Create Foundry resource** - Provision new Azure AI Services multi-service account
- **Create resource group** - Set up resource group before creating resources
- **Register resource provider** - Enable Microsoft.CognitiveServices provider
- **Manual resource creation** - CLI-based resource provisioning

**Do NOT use for:**
- Creating ML workspace hubs/projects (use `microsoft-foundry:project/create`)
- Deploying AI models (use `microsoft-foundry:models/deploy`)
- Managing RBAC permissions (use `microsoft-foundry:rbac`)
- Monitoring resource usage (use `microsoft-foundry:quota`)

## Prerequisites

- **Azure subscription** - Active subscription ([create free account](https://azure.microsoft.com/pricing/purchase-options/azure-account))
- **Azure CLI** - Version 2.0 or later installed
- **Authentication** - Run `az login` before commands
- **RBAC roles** - One of:
  - Contributor
  - Owner
  - Custom role with `Microsoft.CognitiveServices/accounts/write`
- **Resource provider** - `Microsoft.CognitiveServices` must be registered in your subscription
  - If not registered, see [Workflow #3: Register Resource Provider](#3-register-resource-provider)
  - If you lack permissions, ask a subscription Owner/Contributor to register it or grant you `/register/action` privilege

> **Need RBAC help?** See [microsoft-foundry:rbac](../../rbac/rbac.md) for permission management.

## Core Workflows

### 1. Create Resource Group

**Command Pattern:** "Create a resource group for my Foundry resources"

Creates an Azure resource group to contain Foundry resources.

#### Steps

**Step 1: Check existing resource groups**

Before creating a new resource group, first check if there are existing ones:

```bash
az group list --query "[].{Name:name, Location:location}" --out table
```

**If existing resource groups are found:**
- Ask the user if they want to use an existing resource group or create a new one
- If they choose to use an existing one, ask which resource group they want to use
- If they choose an existing resource group, skip to [Workflow #2](#2-create-foundry-resource)

**If no existing resource groups found OR user wants to create new:**
- Continue to Step 2 to create a new resource group

**Step 2: List available Azure regions**

```bash
az account list-locations --query "[].{Region:name}" --out table
```

Common regions:
- `eastus`, `eastus2` - US East Coast
- `westus`, `westus2`, `westus3` - US West Coast
- `centralus` - US Central
- `westeurope`, `northeurope` - Europe
- `southeastasia`, `eastasia` - Asia Pacific

**Step 3: Create resource group**

```bash
az group create \
  --name <resource-group-name> \
  --location <location>
```

**Parameters:**
- `--name`: Unique resource group name
- `--location`: Azure region from step 2

**Step 4: Verify creation**

```bash
az group show --name <resource-group-name>
```

**Expected output:**
- `provisioningState: "Succeeded"`
- Resource group ID
- Location information

#### Example

```bash
# Step 1: Check existing resource groups first
az group list --query "[].{Name:name, Location:location}" --out table

# If existing resource groups found:
#   - Ask user if they want to use existing or create new
#   - If using existing, note the name and skip to create Foundry resource
#   - If creating new, continue below

# If no existing resource groups OR user wants to create new:

# Step 2: List regions
az account list-locations --query "[].{Region:name}" --out table

# Step 3: Create resource group in West US 2
az group create \
  --name rg-ai-services \
  --location westus2

# Step 4: Verify
az group show --name rg-ai-services
```

---

### 2. Create Foundry Resource

**Command Pattern:** "Create a new Azure AI Services resource"

Creates an Azure AI Services multi-service resource (kind: AIServices).

#### Steps

**Step 1: Verify prerequisites**

```bash
# Check Azure CLI version (need 2.0+)
az --version

# Verify authentication
az account show

# Check resource provider registration status
az provider show --namespace Microsoft.CognitiveServices --query "registrationState"
```

If provider not registered, see [Workflow #3](#3-register-resource-provider).

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

#### Example

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

#### SKU Comparison

| SKU | Name | Features | Use Case |
|-----|------|----------|----------|
| F0 | Free | Limited transactions, single region | Development, testing |
| S0 | Standard | Full features, pay-per-use | Production workloads |

---

### 3. Register Resource Provider

**Command Pattern:** "Register Cognitive Services provider"

Registers the Microsoft.CognitiveServices resource provider for the subscription.

#### When Needed

Required when:
- First time creating Cognitive Services in subscription
- Error: `ResourceProviderNotRegistered`
- Insufficient permissions during resource creation

#### Steps

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

#### Example

```bash
# Check current status
az provider show --namespace Microsoft.CognitiveServices --query "registrationState"

# Register if needed
az provider register --namespace Microsoft.CognitiveServices

# Wait and check
sleep 60
az provider show --namespace Microsoft.CognitiveServices --query "registrationState"
```

#### Required Permissions

To register a resource provider, you need one of:
- **Subscription Owner** role
- **Contributor** role
- **Custom role** with `Microsoft.*/register/action` permission

**If you are not the subscription owner:**
1. Ask someone with the **Owner** or **Contributor** role to register the provider for you
2. Alternatively, ask them to grant you the `/register/action` privilege so you can register it yourself

**Alternative registration methods:**
- **Azure CLI** (recommended): `az provider register --namespace Microsoft.CognitiveServices`
- **Azure Portal**: Navigate to Subscriptions → Resource providers → Microsoft.CognitiveServices → Register
- **PowerShell**: `Register-AzResourceProvider -ProviderNamespace Microsoft.CognitiveServices`

> **Need permission help?** Use `microsoft-foundry:rbac` skill to manage roles and assignments.

---

## Common Patterns

### Pattern A: Quick Setup

Complete setup in one go:

```bash
# Check existing resource groups first
az group list --query "[].{Name:name, Location:location}" --out table

# If existing resource groups found, ask user if they want to use one
# If yes, set RG to the existing resource group name
# If no or user wants new, create new resource group below

# Variables
RG="rg-ai-services"  # Use existing RG name or set new name
LOCATION="westus2"
RESOURCE_NAME="my-foundry-resource"

# Create resource group (only if creating new, skip if using existing)
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

## Important Notes

### Resource Kind

- **Must use `--kind AIServices`** for multi-service Foundry resources
- Other kinds (e.g., OpenAI, ComputerVision) create single-service resources
- AIServices provides access to multiple AI services with single endpoint

### SKU Selection

Common SKUs:
- **S0** - Standard tier (most common)
- **F0** - Free tier (limited features)

### Regional Availability

- Different regions may have different service availability
- Check [Azure products by region](https://azure.microsoft.com/global-infrastructure/services/?products=cognitive-services)
- Regional selection affects latency but not runtime availability

---

## Quick Commands

```bash
# Check existing resource groups
az group list --query "[].{Name:name, Location:location}" --out table

# List available regions
az account list-locations --query "[].{Region:name}" --out table

# Create resource group (if needed)
az group create --name rg-ai-services --location westus2

# Create Foundry resource
az cognitiveservices account create \
  --name my-foundry-resource \
  --resource-group rg-ai-services \
  --kind AIServices \
  --sku S0 \
  --location westus2 \
  --yes

# List resources in group
az cognitiveservices account list --resource-group rg-ai-services

# Get resource details
az cognitiveservices account show \
  --name my-foundry-resource \
  --resource-group rg-ai-services

# Delete resource
az cognitiveservices account delete \
  --name my-foundry-resource \
  --resource-group rg-ai-services
```

---

## Troubleshooting

### Resource Creation Fails

**Error:** `ResourceProviderNotRegistered`

**Solution:**
1. If you have Owner/Contributor role, run [Workflow #3](#3-register-resource-provider) to register the provider yourself
2. If you lack permissions, ask a subscription Owner or Contributor to register `Microsoft.CognitiveServices` for you
3. Alternatively, ask them to grant you the `/register/action` privilege

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

---

## External Resources

- [Create multi-service resource](https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource?pivots=azcli)
- [Azure AI Services documentation](https://learn.microsoft.com/en-us/azure/ai-services/)
- [Azure regions with AI Services](https://azure.microsoft.com/global-infrastructure/services/?products=cognitive-services)
