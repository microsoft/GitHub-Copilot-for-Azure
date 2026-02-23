# Model Availability Validation Flow

This reference documents the internal validation flow used when checking model availability in Azure AI Foundry.

## Architecture Overview

Model availability checking follows a **four-phase validation flow**:

```
User Initiates Deployment
            |
Phase 1: Fetch Project & Region Info
            |
Phase 2: Query Available Models by Region
            |
Phase 3: Query Model Capacities (SKU/Version)
            |
Phase 4: Validate & Return Options
            |
Display Availability Status to User
```

## Phase 1: Project & Region Resolution

**Purpose:** Determine where deployments can be created.

| Step | API | What It Does |
|------|-----|--------------|
| Get Project Details | `Microsoft.CognitiveServices/accounts/{accountName}/projects/{projectName}` | Retrieve project's deployment region |
| Get Available Regions | `Microsoft.Compute/skus` | Determine which regions support AIServices |

**Key Insight:** Deployments must be in the same region as the project.

## Phase 2: Model Availability Check

**Purpose:** Determine if the model exists in the target region.

**API Endpoint:**
```
GET /subscriptions/{subscriptionId}/providers/Microsoft.CognitiveServices/locations/{location}/models
```

**Response Fields:**
- Model name, format (OpenAI, MaaS, etc.)
- Version
- Supported SKUs (deployment types)
- Model capabilities
- Lifecycle status

**Failure Points:**
1. **Model Not Found** - Model not available in any region of the subscription
2. **Model Not in Deployment Region** - Model exists elsewhere but not in project's region

## Phase 3: SKU & Capacity Validation

**Purpose:** Check if the requested SKU has available capacity.

**API Endpoint:**
```
GET /subscriptions/{subscriptionId}/providers/Microsoft.CognitiveServices/locations/{location}/modelCapacities
    ?modelFormat={format}&modelName={name}&modelVersion={version}
```

**Response Fields:**
- SKU name (Standard, GlobalStandard, ProvisionedManaged, etc.)
- Available capacity (units available)
- Default/minimum/maximum capacity constraints
- Pricing information

**Capacity Map Structure:**
```json
{
  "Standard": {
    "1.0": 500,    // 500 units available
    "2.0": 0       // 0 units (no quota)
  },
  "GlobalStandard": {
    "1.0": 1000
  }
}
```

## Phase 4: Build Response

**SKU Option States:**

| State | isSupported | hasQuota | Meaning |
|-------|-------------|----------|---------|
| Available | true | true | Can deploy with this SKU |
| No Quota | true | false | SKU available but no capacity |
| Unsupported | false | - | Not available in this region |

## Six Reasons for Model Unavailability

### 1. Model Not in Subscription
- **Symptom:** Model doesn't appear in any region
- **Solutions:** Request access from Azure support, check subscription eligibility

### 2. Model Not in Deployment Region
- **Symptom:** Model available in other regions but not project's region
- **Solutions:** Migrate to supported region, wait for rollout, contact support

### 3. SKU Not Supported in Region
- **Symptom:** Model exists but specific SKU (deployment type) isn't
- **Example:** GlobalStandard only in select regions
- **Solutions:** Choose different SKU, deploy in region with required SKU

### 4. No Available Quota
- **Symptom:** SKU available but `availableCapacity === 0`
- **Solutions:** Wait for quota refresh (monthly), request increase, use dynamic quota, try different version

### 5. Version Not Available
- **Symptom:** Model supports one version but not another
- **Solutions:** Use available version, wait for rollout

### 6. Deployment Type Constraints
- **Symptom:** Can deploy Standard but not ProvisionedManaged
- **Examples:**
  - ProvisionedManaged requires specific subscription tier
  - GlobalProvisionedManaged requires special approval
  - Batch SKU available in fewer regions
- **Solutions:** Choose widely available SKU, upgrade tier, request approval

## API Response Examples

### Success Response
```json
{
  "modelFormat": "OpenAI",
  "skuSupported": true,
  "deploymentCategory": "AOAI",
  "deploymentLocation": "eastus",
  "sku": {
    "defaultSelection": "GlobalStandard",
    "options": [
      { "name": "GlobalStandard", "isSupported": true, "hasQuota": true },
      { "name": "Standard", "isSupported": true, "hasQuota": false }
    ],
    "selectedSkuSupportedRegions": ["eastus", "westus", "northeurope"]
  },
  "version": {
    "defaultSelection": "1.0",
    "options": [
      { "name": "1.0", "isDefault": true, "hasQuota": true },
      { "name": "0.2", "isDefault": false, "hasQuota": true }
    ]
  },
  "capacity": {
    "defaultSelection": 150,
    "minimum": 1,
    "maximum": 1000,
    "step": 1
  }
}
```

### Failure Response (Model Not in Region)
```json
{
  "modelFormat": "OpenAI",
  "skuSupported": false,
  "deploymentCategory": "AOAI",
  "deploymentLocation": "eastus",
  "sku": {
    "defaultSelection": "GlobalStandard",
    "options": [
      { "name": "GlobalStandard", "isSupported": false, "hasQuota": false }
    ],
    "selectedSkuSupportedRegions": ["westus", "northeurope"]
  }
}
```

## Caching Behavior

| Query | Cache Duration | Rationale |
|-------|----------------|-----------|
| Models catalog | 1 hour | Changes infrequently |
| Model capacities | 5 minutes | Changes frequently |
| SKUs/Locations | 1 hour | Infrastructure changes rarely |

## Create vs Edit Mode

| Mode | Regions Queried | Behavior |
|------|-----------------|----------|
| **Create** | All AIServices regions | Can suggest alternatives if unavailable |
| **Edit** | Current deployment region only | Preserves existing allocation if SKU unchanged |
