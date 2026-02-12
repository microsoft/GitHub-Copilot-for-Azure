# Examples: preset

Real-world scenarios demonstrating different workflows through the skill.

---

## Example 1: Fast Path - Current Region Has Capacity

**User Request:**
> "Deploy gpt-4o for my production project"

**Context:**
- User already authenticated
- Project resource ID: `/subscriptions/b17253fa-f327-42d6-9686-f3e553e24763/resourceGroups/rg-production/providers/Microsoft.CognitiveServices/accounts/banide-1031-resource/projects/banide-1031`
- Model: gpt-4o
- Current region (East US) has capacity

**Skill Flow:**

```bash
# Phase 1: Check authentication
$ az account show --query "{Subscription:name, User:user.name}" -o table
Subscription                User
--------------------------  ------------------------
Data Science VM Team        banide@microsoft.com

# Phase 2: Parse project resource ID
$ PROJECT_RESOURCE_ID="/subscriptions/b17253fa-f327-42d6-9686-f3e553e24763/resourceGroups/rg-production/providers/Microsoft.CognitiveServices/accounts/banide-1031-resource/projects/banide-1031"

Parsed project details:
  Subscription: b17253fa-f327-42d6-9686-f3e553e24763
  Resource Group: rg-production
  Account: banide-1031-resource
  Project: banide-1031

$ az account set --subscription "b17253fa-f327-42d6-9686-f3e553e24763"

✓ Project found
  Region: eastus

$ PROJECT_REGION="eastus"
$ PROJECT_NAME="banide-1031"
$ RESOURCE_GROUP="rg-production"

# Phase 3: Model already specified
$ MODEL_NAME="gpt-4o"
$ MODEL_VERSION="2024-08-06"  # Latest stable

# Phase 4: Check current region capacity
$ CAPACITY_JSON=$(az rest --method GET \
  --url "https://management.azure.com/subscriptions/.../providers/Microsoft.CognitiveServices/locations/eastus/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=gpt-4o&modelVersion=2024-08-06")

$ CURRENT_CAPACITY=$(echo "$CAPACITY_JSON" | jq -r '.value[] | select(.properties.skuName=="GlobalStandard") | .properties.availableCapacity')

✓ Current region (eastus) has capacity: 150000 TPM
Proceeding with deployment...

# Skip Phase 5-6 (region selection) - not needed

# Phase 7: Deploy
$ DEPLOYMENT_NAME="gpt-4o-20260205-143022"
$ az cognitiveservices account deployment create \
  --name "banide-1031" \
  --resource-group "rg-production" \
  --deployment-name "$DEPLOYMENT_NAME" \
  --model-name "gpt-4o" \
  --model-version "2024-08-06" \
  --model-format "OpenAI" \
  --sku-name "GlobalStandard" \
  --sku-capacity 100000

# Phase 8: Monitor
Status: Creating... (0s elapsed)
Status: Creating... (10s elapsed)
Status: Creating... (20s elapsed)
✓ Deployment successful!

═══════════════════════════════════════════
✓ Deployment Successful!
═══════════════════════════════════════════

Deployment Name: gpt-4o-20260205-143022
Model: gpt-4o
Version: 2024-08-06
Region: eastus
SKU: GlobalStandard
Capacity: 100K TPM
Endpoint: https://banide-1031-resource.cognitiveservices.azure.com/

═══════════════════════════════════════════
```

**Duration:** ~45 seconds (fast path)

**Key Points:**
- PROJECT_RESOURCE_ID parsed to extract subscription, RG, account, project
- Current region check succeeded immediately
- No region selection needed
- Deployed with 100K TPM (default safe amount)

---

## Example 2: Alternative Region - No Capacity in Current Region

**User Request:**
> "Deploy gpt-4-turbo to my dev environment"

**Context:**
- User authenticated
- Active project: `dev-ai-hub` in West US 2
- Model: gpt-4-turbo
- Current region (West US 2) has NO capacity
- Alternative regions available

**Skill Flow:**

```bash
# Phase 1-3: Authentication, project, model (same as Example 1)
$ PROJECT_NAME="dev-ai-hub"
$ RESOURCE_GROUP="rg-development"
$ PROJECT_REGION="westus2"
$ MODEL_NAME="gpt-4-turbo"
$ MODEL_VERSION="2024-06-15"

# Phase 4: Check current region
$ CURRENT_CAPACITY=$(echo "$CAPACITY_JSON" | jq -r '.value[] | select(.properties.skuName=="GlobalStandard") | .properties.availableCapacity')

⚠ Current region (westus2) has no available capacity
Checking alternative regions...

# Phase 5: Query all regions
$ ALL_REGIONS_JSON=$(az rest --method GET \
  --url "https://management.azure.com/subscriptions/.../providers/Microsoft.CognitiveServices/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=gpt-4-turbo&modelVersion=2024-06-15")

⚠ No Capacity in Current Region

The current project's region (westus2) does not have available capacity for gpt-4-turbo.

Available Regions (with capacity):
  • East US 2 - 120K TPM
  • Sweden Central - 100K TPM
  • West US - 80K TPM
  • North Central US - 60K TPM

Unavailable Regions:
  ✗ North Europe (Model not supported)
  ✗ France Central (Insufficient quota - 0 TPM available)
  ✗ UK South (Model not supported)
  ✗ West US 2 (Insufficient quota - 0 TPM available)

# Phase 6: User selects region
# Claude presents options via AskUserQuestion
# User selects: "East US 2"

$ SELECTED_REGION="eastus2"

# Find projects in East US 2
Projects in eastus2:
  • my-ai-project-prod (rg-production)
  • research-foundry (rg-research)

# User selects: my-ai-project-prod
$ PROJECT_NAME="my-ai-project-prod"
$ RESOURCE_GROUP="rg-production"

# Phase 7: Deploy to selected region/project
$ DEPLOYMENT_NAME="gpt-4-turbo-20260205-144530"
$ az cognitiveservices account deployment create \
  --name "my-ai-project-prod" \
  --resource-group "rg-production" \
  --deployment-name "$DEPLOYMENT_NAME" \
  --model-name "gpt-4-turbo" \
  --model-version "2024-06-15" \
  --model-format "OpenAI" \
  --sku-name "GlobalStandard" \
  --sku-capacity 100000

✓ Deployment successful!

═══════════════════════════════════════════
✓ Deployment Successful!
═══════════════════════════════════════════

Deployment Name: gpt-4-turbo-20260205-144530
Model: gpt-4-turbo
Version: 2024-06-15
Region: eastus2
SKU: GlobalStandard
Capacity: 100K TPM
Endpoint: https://my-ai-project-prod.openai.azure.com/

═══════════════════════════════════════════
```

**Duration:** ~2 minutes (with region selection)

**Key Points:**
- Current region had no capacity
- Multi-region analysis performed
- User chose from available regions
- Deployed to different project in optimal region

---

## Example 3: Create New Project in Optimal Region

**User Request:**
> "Deploy gpt-4o-mini - I need it in Europe for data residency"

**Context:**
- User authenticated
- Current project in East US
- User needs European deployment
- No existing project in target European region

**Skill Flow:**

```bash
# Phase 1-4: Standard flow (current region check fails)
$ MODEL_NAME="gpt-4o-mini"
$ MODEL_VERSION="2024-07-18"

⚠ Current region (eastus) does not have capacity for gpt-4o-mini
Checking alternative regions...

Available Regions (with capacity):
  • Sweden Central - 150K TPM
  • North Europe - 120K TPM
  • West Europe - 100K TPM
  • East US 2 - 90K TPM

# User selects: Sweden Central (for data residency)
$ SELECTED_REGION="swedencentral"

# Phase 6: Check for projects in Sweden Central
$ PROJECTS_IN_REGION=$(az cognitiveservices account list \
  --query "[?kind=='AIProject' && location=='swedencentral'].{Name:name, ResourceGroup:resourceGroup}" \
  --output json)

No projects found in swedencentral

Would you like to create a new project? (yes/no)
> yes

# Create new project
$ USER_ALIAS="john-doe"
$ RANDOM_SUFFIX="a7f3"
$ NEW_PROJECT_NAME="john-doe-aiproject-a7f3"
$ NEW_RESOURCE_GROUP="rg-production"  # Using existing RG

Creating AI Services hub: john-doe-aiproject-a7f3-hub in swedencentral...
{
  "id": "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/john-doe-aiproject-a7f3-hub",
  "location": "swedencentral",
  "name": "john-doe-aiproject-a7f3-hub",
  "properties": {
    "provisioningState": "Succeeded"
  }
}

Creating AI Foundry project: john-doe-aiproject-a7f3...
{
  "id": "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/john-doe-aiproject-a7f3",
  "kind": "AIProject",
  "location": "swedencentral",
  "name": "john-doe-aiproject-a7f3",
  "properties": {
    "provisioningState": "Succeeded"
  }
}

✓ Project created successfully

# Phase 7: Deploy to new project
$ PROJECT_NAME="john-doe-aiproject-a7f3"
$ DEPLOYMENT_NAME="gpt-4o-mini-20260205-150245"

$ az cognitiveservices account deployment create \
  --name "john-doe-aiproject-a7f3" \
  --resource-group "rg-production" \
  --deployment-name "$DEPLOYMENT_NAME" \
  --model-name "gpt-4o-mini" \
  --model-version "2024-07-18" \
  --model-format "OpenAI" \
  --sku-name "GlobalStandard" \
  --sku-capacity 150000

✓ Deployment successful!

═══════════════════════════════════════════
✓ Deployment Successful!
═══════════════════════════════════════════

Deployment Name: gpt-4o-mini-20260205-150245
Model: gpt-4o-mini
Version: 2024-07-18
Region: swedencentral
SKU: GlobalStandard
Capacity: 150K TPM
Endpoint: https://john-doe-aiproject-a7f3.openai.azure.com/

═══════════════════════════════════════════
```

**Duration:** ~4 minutes (includes project creation)

**Key Points:**
- User chose European region for compliance
- No existing project in target region
- New project created automatically
- Deployed with full available capacity

---

## Example 4: Insufficient Quota Everywhere

**User Request:**
> "Deploy gpt-4 to any available region"

**Context:**
- User authenticated
- Model: gpt-4 (older model with high demand)
- All regions exhausted quota

**Skill Flow:**

```bash
# Phase 1-4: Standard flow
$ MODEL_NAME="gpt-4"
$ MODEL_VERSION="0613"

⚠ Current region (eastus) has no available capacity
Checking alternative regions...

# Phase 5: Query all regions
$ ALL_REGIONS_JSON=$(az rest --method GET ...)

❌ No Available Capacity in Any Region

No regions have available capacity for gpt-4 with GlobalStandard SKU.

Next Steps:
1. Request quota increase:
   https://portal.azure.com/#view/Microsoft_Azure_Capacity/QuotaMenuBlade

2. Check existing deployments (may be using quota):
   az cognitiveservices account deployment list \
     --name my-ai-project-prod \
     --resource-group rg-production

3. Consider alternative models with lower capacity requirements:
   • gpt-4o (similar performance, better availability)
   • gpt-4o-mini (cost-effective, lower capacity)

# User lists existing deployments
$ az cognitiveservices account deployment list \
  --name my-ai-project-prod \
  --resource-group rg-production \
  --output table

Name                        Model           Capacity  Status
--------------------------  --------------  --------  ---------
gpt-4-0613-20260101-120000  gpt-4          150000    Succeeded
gpt-4o-mini-prod            gpt-4o-mini     50000    Succeeded

# User decides to use alternative model
# Re-run skill with gpt-4o instead
```

**Key Points:**
- Graceful failure with actionable guidance
- Lists existing deployments
- Suggests alternatives
- Provides links to quota management

---

## Example 5: First-Time User - No Project

**User Request:**
> "I want to deploy gpt-4o but I don't have an AI Foundry project yet"

**Context:**
- User authenticated
- No existing AI Foundry projects
- Needs full setup from scratch

**Skill Flow:**

```bash
# Phase 1: Authentication OK
$ az account show --query "{Subscription:name}" -o table
Subscription
--------------------------
Production Subscription

# Phase 2: List projects
$ az cognitiveservices account list \
  --query "[?kind=='AIProject'].{Name:name, Location:location}" \
  --output table

(empty result)

No AI Foundry projects found in subscription.

Let's create your first project. Please select a region:

Available regions for AI Foundry:
  • East US 2 (Recommended - high capacity)
  • Sweden Central (Recommended - high capacity)
  • West US
  • North Europe
  • West Europe

# User selects: East US 2
$ SELECTED_REGION="eastus2"

# Prompt for project details
Project name: > my-first-ai-project
Resource group: > rg-ai-services

Creating resource group: rg-ai-services...
$ az group create --name rg-ai-services --location eastus2

Creating AI Services hub...
Creating AI Foundry project...
✓ Project created successfully

# Phase 3: Model selection
$ MODEL_NAME="gpt-4o"
$ MODEL_VERSION="2024-08-06"

# Phase 4: Check capacity (new project's region)
✓ Current region (eastus2) has capacity: 150000 TPM

# Phase 7: Deploy
$ DEPLOYMENT_NAME="gpt-4o-20260205-152010"
$ az cognitiveservices account deployment create ...

✓ Deployment successful!

═══════════════════════════════════════════
✓ Deployment Successful!
═══════════════════════════════════════════

Deployment Name: gpt-4o-20260205-152010
Model: gpt-4o
Version: 2024-08-06
Region: eastus2
SKU: GlobalStandard
Capacity: 100K TPM
Endpoint: https://my-first-ai-project.openai.azure.com/

═══════════════════════════════════════════

Next steps:
• Test in Azure AI Foundry playground: https://ai.azure.com
• View project: https://ai.azure.com/resource/overview?resourceId=/subscriptions/.../my-first-ai-project
• Set up monitoring and alerts
```

**Duration:** ~5 minutes (full setup)

**Key Points:**
- Complete onboarding experience
- Resource group + project creation
- Capacity check on new project
- Successful first deployment

---

## Example 6: Deployment Name Conflict

**User Request:**
> "Deploy gpt-4o-mini"

**Context:**
- User has many existing deployments
- Generated name conflicts with existing deployment

**Skill Flow:**

```bash
# Phase 1-6: Standard flow
$ MODEL_NAME="gpt-4o-mini"
$ MODEL_VERSION="2024-07-18"
$ DEPLOYMENT_NAME="gpt-4o-mini-20260205-153000"

# Phase 7: Deploy
$ az cognitiveservices account deployment create \
  --name "my-ai-project-prod" \
  --resource-group "rg-production" \
  --deployment-name "$DEPLOYMENT_NAME" \
  --model-name "gpt-4o-mini" \
  --model-version "2024-07-18" \
  --model-format "OpenAI" \
  --sku-name "GlobalStandard" \
  --sku-capacity 50000

❌ Error: Deployment "gpt-4o-mini-20260205-153000" already exists

# Retry with random suffix
$ DEPLOYMENT_NAME="gpt-4o-mini-20260205-153000-$(openssl rand -hex 2)"
$ echo "Retrying with name: $DEPLOYMENT_NAME"
Retrying with name: gpt-4o-mini-20260205-153000-7b9e

$ az cognitiveservices account deployment create ...

✓ Deployment successful!

Deployment Name: gpt-4o-mini-20260205-153000-7b9e
Model: gpt-4o-mini
Version: 2024-07-18
Region: eastus
SKU: GlobalStandard
Capacity: 50K TPM
```

**Key Points:**
- Automatic conflict detection
- Random suffix appended
- Retry succeeded
- User notified of final name

---

## Example 7: Multi-Version Model Selection

**User Request:**
> "Deploy the latest gpt-4o"

**Context:**
- Model has multiple versions available (0314, 0613, 1106, etc.)
- User wants latest stable version

**Skill Flow:**

```bash
# Phase 3: Get model versions
$ az cognitiveservices account list-models \
  --name "my-ai-project-prod" \
  --resource-group "rg-production" \
  --query "[?name=='gpt-4o'].{Name:name, Version:version}" \
  -o table

Name     Version
-------  ----------
gpt-4o   2024-02-15
gpt-4o   2024-05-13
gpt-4o   2024-08-06  ← Latest

$ MODEL_VERSION="2024-08-06"

# Phase 4: Check capacity
# API aggregates capacity across all versions, shows highest available

$ CAPACITY_JSON=$(az rest --method GET ...)

Available capacity: 150K TPM (aggregated across versions)

# Continue with deployment using latest version
✓ Deployment successful with version 2024-08-06
```

**Key Points:**
- Multiple versions handled gracefully
- Latest stable version selected
- Capacity aggregated across versions
- User informed of version choice

---

## Summary of Scenarios

| Scenario | Duration | Key Features |
|----------|----------|--------------|
| **Example 1: Fast Path** | ~45s | Current region has capacity, direct deploy |
| **Example 2: Alternative Region** | ~2m | Region selection, project switch |
| **Example 3: New Project** | ~4m | Project creation in optimal region |
| **Example 4: No Quota** | N/A | Graceful failure, actionable guidance |
| **Example 5: First-Time User** | ~5m | Complete setup, onboarding |
| **Example 6: Name Conflict** | ~1m | Conflict resolution, retry logic |
| **Example 7: Multi-Version** | ~1m | Version selection, capacity aggregation |

---

## Common Patterns

### Pattern A: Quick Deployment (Current Region OK)
```
Auth → Get Project → Check Current Region (✓) → Deploy
```

### Pattern B: Region Selection (No Capacity)
```
Auth → Get Project → Check Current Region (✗) → Query All Regions → Select Region → Select/Create Project → Deploy
```

### Pattern C: Full Onboarding (New User)
```
Auth → No Projects Found → Create Project → Select Model → Deploy
```

### Pattern D: Error Recovery
```
Deploy (✗) → Analyze Error → Apply Fix → Retry
```

---

## Tips for Using Examples

1. **Start with Example 1** for typical workflow
2. **Use Example 2** to understand region selection
3. **Reference Example 4** for error handling patterns
4. **Consult Example 5** for onboarding new users
5. **Apply Example 6** for conflict resolution logic
6. **See Example 7** for version handling

All examples use real Azure CLI commands that can be executed directly.
