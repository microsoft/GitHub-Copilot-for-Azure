# Technical Notes: customize-deployment

> **Note:** This file is for audit and maintenance purposes only. It is NOT loaded during skill execution.

## Overview

The `customize-deployment` skill provides an interactive guided workflow for deploying Azure OpenAI models with full customization control. It mirrors the Azure AI Foundry portal's "Customize Deployment" experience but adapted for CLI/Agent workflows.

## UX Implementation Reference

### Primary Source Code

**Main Component:**
```
C:\Users\banide\gitrepos\combine\azure-ai-foundry\app\components\models\CustomizeDeployment\CustomizeDeployment.tsx
```

**Key Files:**
- `CustomizeDeployment.tsx` - Main component (lines 64-600+)
- `useGetDeploymentOptions.ts` - Hook for fetching deployment options
- `getDeploymentOptionsResolver.ts` - API resolver
- `getDeploymentOptions.ts` - Server-side API route
- `getDeploymentOptionsUtils.ts` - Helper functions

### Component Flow (UX)

```typescript
// 1. User opens customize deployment drawer
<CustomizeDeployment 
  isOpen={true}
  modelName="gpt-4o"  // Create mode
  projectId="/subscriptions/.../projects/..."
/>

// 2. Component fetches deployment options
const { data: deploymentOptions } = useGetDeploymentOptions({
  modelName: "gpt-4o",
  projectInScopeId: projectId,
  selectedSku: undefined,      // Initial call
  selectedVersion: undefined
});

// 3. User selects SKU → Refetch with selectedSku
const { data } = useGetDeploymentOptions({
  modelName: "gpt-4o",
  projectInScopeId: projectId,
  selectedSku: "GlobalStandard",  // Now included
  selectedVersion: undefined
});

// 4. User selects version → Refetch with both
const { data } = useGetDeploymentOptions({
  modelName: "gpt-4o",
  projectInScopeId: projectId,
  selectedSku: "GlobalStandard",
  selectedVersion: "2024-11-20"   // Now included
});

// 5. User configures capacity, RAI policy, etc.

// 6. User clicks deploy → Create deployment
createOrUpdate({
  deploymentName,
  modelName,
  modelVersion,
  skuName,
  capacity,
  raiPolicyName,
  versionUpgradePolicy,
  // ...
});
```

## Cascading Selection Pattern

### How It Works (UX Implementation)

The UX uses a **cascading selection** pattern to provide contextual options at each step:

#### Stage 1: Initial Load (No Selections)
```typescript
// Request
POST /api/getDeploymentOptions
{
  "modelName": "gpt-4o",
  "projectInScopeId": "/subscriptions/.../projects/..."
}

// Response
{
  "sku": {
    "defaultSelection": "GlobalStandard",
    "options": [
      { "name": "GlobalStandard", "displayName": "Global Standard", ... },
      { "name": "Standard", "displayName": "Standard", ... },
      { "name": "ProvisionedManaged", "displayName": "Provisioned", ... }
    ]
  },
  "version": {
    "defaultSelection": "2024-11-20",
    "options": [
      { "version": "2024-11-20", "isLatest": true },
      { "version": "2024-08-06", "isLatest": false },
      { "version": "2024-05-13", "isLatest": false }
    ]
  },
  "capacity": {
    "defaultSelection": 10000,
    "minimum": 1000,
    "maximum": 150000,
    "step": 1000
  },
  // ...
}
```

**Key Point:** Returns ALL available SKUs and versions at this stage.

#### Stage 2: After SKU Selection
```typescript
// Request (userTouched.sku = true)
POST /api/getDeploymentOptions
{
  "modelName": "gpt-4o",
  "projectInScopeId": "/subscriptions/.../projects/...",
  "selectedSku": "GlobalStandard"  // ← Now included
}

// Response
{
  "sku": {
    "defaultSelection": "GlobalStandard",
    "options": [...],
    "selectedSkuSupportedRegions": ["eastus2", "westus", "swedencentral", ...]
  },
  "version": {
    "defaultSelection": "2024-11-20",
    "options": [
      // ← Now filtered to versions available for GlobalStandard
      { "version": "2024-11-20", "isLatest": true },
      { "version": "2024-08-06", "isLatest": false }
    ],
    "selectedSkuSupportedVersions": ["2024-11-20", "2024-08-06", ...]
  },
  "capacity": {
    // ← Capacity updated for GlobalStandard
    "defaultSelection": 10000,
    "minimum": 1000,
    "maximum": 300000,
    "step": 1000
  },
  // ...
}
```

**Key Point:** Version list filtered to those available for selected SKU. Capacity range updated.

#### Stage 3: After Version Selection
```typescript
// Request (userTouched.version = true)
POST /api/getDeploymentOptions
{
  "modelName": "gpt-4o",
  "projectInScopeId": "/subscriptions/.../projects/...",
  "selectedSku": "GlobalStandard",
  "selectedVersion": "2024-11-20"  // ← Now included
}

// Response
{
  "sku": {
    "defaultSelection": "GlobalStandard",
    "options": [...],
    "selectedSkuSupportedRegions": ["eastus2", "westus", "swedencentral"]
  },
  "version": {
    "defaultSelection": "2024-11-20",
    "options": [...]
  },
  "capacity": {
    // ← Precise capacity for this SKU + version combo
    "defaultSelection": 10000,
    "minimum": 1000,
    "maximum": 150000,
    "step": 1000
  },
  "raiPolicies": {
    // ← RAI policies specific to this version
    "defaultSelection": { "name": "Microsoft.DefaultV2", ... },
    "options": [
      { "name": "Microsoft.DefaultV2", ... },
      { "name": "Microsoft.Prompt-Shield", ... }
    ]
  },
  // ...
}
```

**Key Point:** All options now precisely scoped to selected SKU + version combination.

### Implementation in Skill

For CLI/Agent workflow, we **simplify** this pattern:

1. **Initial Query:** Get all available versions and SKUs
   ```bash
   az cognitiveservices account list-models --name <account> --resource-group <rg>
   ```

2. **User Selects Version:** Present available versions, user chooses

3. **User Selects SKU:** Present SKU options (hardcoded common SKUs)

4. **Query Capacity:** Get capacity range for selected SKU
   ```bash
   az rest --method GET \
     --url "https://management.azure.com/.../modelCapacities?...&modelName=<model>&modelVersion=<version>"
   ```

5. **User Configures:** Capacity, RAI policy, advanced options

**Rationale for Simplification:**
- CLI workflow is linear (not interactive UI with live updates)
- Reduces API calls and complexity
- User makes explicit choices at each step
- Still provides full customization control

## API Reference

### 1. List Model Versions

**Operation:** Get available versions for a model

**Azure CLI Command:**
```bash
az cognitiveservices account list-models \
  --name <account-name> \
  --resource-group <resource-group> \
  --query "[?name=='<model-name>'].{Version:version, Format:format}" \
  --output json
```

**Example Output:**
```json
[
  {"Version": "2024-11-20", "Format": "OpenAI"},
  {"Version": "2024-08-06", "Format": "OpenAI"},
  {"Version": "2024-05-13", "Format": "OpenAI"}
]
```

**Source:** ARM API `GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/models`

**Skill Usage:** Phase 5 - List and Select Model Version

---

### 2. Query Model Capacity

**Operation:** Get available capacity for a model/version/SKU in a region

**ARM REST API:**
```
GET /subscriptions/{subscriptionId}/providers/Microsoft.CognitiveServices/locations/{location}/modelCapacities
?api-version=2024-10-01
&modelFormat=OpenAI
&modelName={modelName}
&modelVersion={modelVersion}
```

**Azure CLI (via az rest):**
```bash
az rest --method GET \
  --url "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/locations/$LOCATION/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=$MODEL_NAME&modelVersion=$MODEL_VERSION"
```

**Example Response:**
```json
{
  "value": [
    {
      "location": "eastus2",
      "properties": {
        "skuName": "GlobalStandard",
        "availableCapacity": 150000,
        "supportedDeploymentTypes": ["Deployment"]
      }
    },
    {
      "location": "eastus2",
      "properties": {
        "skuName": "Standard",
        "availableCapacity": 100000,
        "supportedDeploymentTypes": ["Deployment"]
      }
    },
    {
      "location": "eastus2",
      "properties": {
        "skuName": "ProvisionedManaged",
        "availableCapacity": 500,
        "supportedDeploymentTypes": ["Deployment"]
      }
    }
  ]
}
```

**UX Source:**
- `listModelCapacitiesByRegionResolver.ts` (lines 33-60)
- `useModelCapacity.ts` (lines 112-178)

**Skill Usage:** Phase 7 - Configure Capacity

---

### 3. List RAI Policies

**Operation:** Get available content filtering policies

**Note:** As of 2024-10-01 API, there's no dedicated endpoint for listing RAI policies. The UX uses hardcoded policy names with optional custom policies from project configuration.

**Common Policies:**
- `Microsoft.DefaultV2` - Default balanced filtering
- `Microsoft.Prompt-Shield` - Enhanced security filtering
- Custom policies (project-specific)

**Skill Approach:** Use hardcoded common policies + allow custom input

**Alternative (If Custom Policies Needed):**
Query project configuration for custom policies:
```bash
az cognitiveservices account show \
  --name <account> \
  --resource-group <rg> \
  --query "properties.contentFilters" -o json
```

---

### 4. Create Deployment

**Operation:** Create a new model deployment

**Azure CLI Command:**
```bash
az cognitiveservices account deployment create \
  --name <account-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --model-name <model-name> \
  --model-version <model-version> \
  --model-format "OpenAI" \
  --sku-name <sku-name> \
  --sku-capacity <capacity>
```

**Supported SKU Names:**
- `GlobalStandard` - Multi-region load balancing ✅ (Now supported in CLI)
- `Standard` - Single region ✅
- `ProvisionedManaged` - PTU capacity ✅
- `DataZoneStandard` - Data zone isolation ✅

**Example (GlobalStandard):**
```bash
az cognitiveservices account deployment create \
  --name "banide-host-resource" \
  --resource-group "bani-host" \
  --deployment-name "gpt-4o-production" \
  --model-name "gpt-4o" \
  --model-version "2024-11-20" \
  --model-format "OpenAI" \
  --sku-name "GlobalStandard" \
  --sku-capacity 50000
```

**Example (ProvisionedManaged/PTU):**
```bash
az cognitiveservices account deployment create \
  --name "banide-host-resource" \
  --resource-group "bani-host" \
  --deployment-name "gpt-4o-ptu" \
  --model-name "gpt-4o" \
  --model-version "2024-11-20" \
  --model-format "OpenAI" \
  --sku-name "ProvisionedManaged" \
  --sku-capacity 200  # PTU units
```

**CLI Support Status (as of 2026-02-09):**
- ✅ GlobalStandard SKU now supported (previously required REST API)
- ✅ All standard parameters supported
- ⚠️ Advanced options may require REST API (see below)

**UX Source:**
- `createOrUpdateModelDeploymentResolver.ts` (lines 38-60)
- `useCreateUpdateDeployment.tsx` (lines 125-161)

---

### 5. Advanced Deployment Options

**Note:** Some advanced options may not be fully supported via CLI and may require REST API.

#### Dynamic Quota

**CLI Support:** ❓ Unknown (not documented in `az cognitiveservices account deployment create --help`)

**REST API:**
```json
PUT /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/deployments/{deployment}
?api-version=2024-10-01

{
  "properties": {
    "model": { "name": "gpt-4o", "version": "2024-11-20", "format": "OpenAI" },
    "versionUpgradeOption": "OnceNewDefaultVersionAvailable",
    "raiPolicyName": "Microsoft.DefaultV2",
    "dynamicThrottlingEnabled": true  // ← Dynamic quota
  },
  "sku": {
    "name": "GlobalStandard",
    "capacity": 50000
  }
}
```

#### Priority Processing

**CLI Support:** ❓ Unknown

**REST API:**
```json
{
  "properties": {
    ...
    "callRateLimit": {
      "rules": [
        {
          "key": "priority",
          "value": "high"
        }
      ]
    }
  }
}
```

#### Spillover Deployment

**CLI Support:** ❓ Unknown

**REST API:**
```json
{
  "properties": {
    ...
    "spilloverDeploymentName": "gpt-4o-backup"
  }
}
```

**Recommendation for Skill:**
1. Use CLI for basic parameters (model, version, SKU, capacity)
2. Document advanced options as "may require REST API"
3. Provide REST API examples in _TECHNICAL_NOTES.md for reference
4. Focus on common use cases (most don't need advanced options)

---

## Design Decisions

### 1. Simplified Cascading Pattern

**Decision:** Use linear prompt flow instead of live API updates

**Rationale:**
- CLI/Agent workflow is sequential, not interactive UI
- Reduces API calls (performance + cost)
- Clearer user experience (explicit choices)
- Easier to implement and maintain

**Trade-off:** User doesn't see real-time filtering of options, but still gets full control

---

### 2. Hardcoded SKU Options

**Decision:** Present fixed list of common SKUs instead of querying API

**Common SKUs:**
- GlobalStandard
- Standard
- ProvisionedManaged
- (DataZoneStandard - if needed)

**Rationale:**
- No dedicated API endpoint for listing SKUs
- SKU names are stable (rarely change)
- Reduces complexity
- Matches UX approach (hardcoded SKU list)

**Source:** `getDeploymentOptionsUtils.ts:getDefaultSku` (hardcoded SKU logic)

---

### 3. RAI Policy Selection

**Decision:** Use common policy names + allow custom input

**Common Policies:**
- Microsoft.DefaultV2 (recommended)
- Microsoft.Prompt-Shield

**Rationale:**
- No API endpoint for listing RAI policies
- Most users use default policies
- Custom policies are project-specific (rare)
- Simple input allows flexibility

**UX Source:** `CustomizeDeployment.tsx` (hardcoded policy names in dropdown)

---

### 4. Strict Capacity Validation (CRITICAL)

**Decision:** Block deployment if capacity query fails OR user input exceeds available quota

**Implementation:**
1. **Phase 7 MUST succeed** - Query capacity API to get available quota
2. **If query fails** - Exit with error, DO NOT proceed with defaults
3. **User input validation** - Reject (not auto-adjust) values outside min/max range
4. **Show clear error** - Display requested vs available when over quota
5. **Allow 3 attempts** - Give user chance to correct input
6. **No silent adjustments** - Never auto-reduce capacity without explicit user consent

**Validation Rules:**
```powershell
# MUST reject if:
- inputCapacity < minCapacity (e.g., < 1000 TPM)
- inputCapacity > maxCapacity (e.g., > available quota)
- inputCapacity % stepCapacity != 0 (e.g., not multiple of 1000)

# Error messages MUST show:
- What user entered
- What the limit is
- Valid range
- How to request increase (for quota issues)
```

**Rationale:**
- **Prevents deployment failures** - Catches quota issues before API call
- **User clarity** - Clear feedback about quota limits
- **No surprises** - User knows exactly what they're getting
- **Quota awareness** - Educates users about their limits

**Bad Example (Old Approach):**
```powershell
if ($DEPLOY_CAPACITY -gt $maxCapacity) {
  Write-Output "⚠ Capacity above maximum. Setting to $maxCapacity $unit"
  $DEPLOY_CAPACITY = $maxCapacity  # WRONG - Silent adjustment
}
```

**Good Example (Current Approach):**
```powershell
if ($inputCapacity -gt $maxCapacity) {
  Write-Output "❌ Insufficient Quota!"
  Write-Output "   Requested: $inputCapacity $unit"
  Write-Output "   Available: $maxCapacity $unit"
  # REJECT and ask again - do not proceed
  continue
}
```

**UX Behavior:** UX also validates capacity in real-time and shows error if over quota (QuotaSlider.tsx validation)

**Date Updated:** 2026-02-09 (after user feedback)

---

### 5. PTU Calculator

**Decision:** Provide formula, don't implement interactive calculator

**Formula:**
```
Estimated PTU = (Input TPM × 0.001) + (Output TPM × 0.002) + (Requests/min × 0.1)
```

**Rationale:**
- Simple formula, easy to calculate manually or with calculator
- Interactive calculator adds complexity for limited value
- UX has dedicated calculator component (out of scope for CLI skill)
- Document formula clearly in SKILL.md

**UX Source:** `PtuCalculator.tsx` (interactive calculator component)

**Alternative:** Could be added in future as separate helper script if needed

---

### 5. Version Upgrade Policy

**Decision:** Always prompt for version upgrade policy

**Options:**
- OnceNewDefaultVersionAvailable (recommended)
- OnceCurrentVersionExpired
- NoAutoUpgrade

**Rationale:**
- Important decision affecting deployment behavior
- Different requirements for prod vs dev
- UX always presents this option
- Low overhead (simple selection)

**UX Source:** `VersionSettings.tsx` (version upgrade policy selector)

---

### 6. Capacity Validation

**Decision:** Validate capacity client-side before deployment

**Validation Rules:**
- Must be >= minimum
- Must be <= maximum
- Must be multiple of step

**Rationale:**
- Prevents deployment failures
- Better user experience (immediate feedback)
- Reduces failed API calls
- Matches UX validation logic

**UX Source:** `QuotaSlider.tsx` (capacity validation)

---

### 7. Deployment Name Generation

**Decision:** Auto-generate unique name with option for custom

**Pattern:**
1. Base name = model name (e.g., "gpt-4o")
2. If exists, append counter: "gpt-4o-2", "gpt-4o-3", etc.
3. Allow user to override with custom name

**Rationale:**
- Prevents name conflicts
- Reasonable defaults (most users accept)
- Flexibility for those who need custom names
- Matches UX behavior

**UX Source:** `deploymentUtil.ts:getDefaultDeploymentName`

---

## CLI Gaps and Workarounds

### 1. No Native Capacity Query Command

**Gap:** No `az cognitiveservices` command to query available capacity

**Workaround:** Use ARM REST API via `az rest`

**Status:** Documented in `deploy-model-optimal-region/_TECHNICAL_NOTES.md`

---

### 2. Advanced Deployment Options

**Gap:** Dynamic quota, priority processing, spillover may not be supported in CLI

**Current Status:** Unknown (needs testing)

**Workaround:**
1. Use REST API for full control
2. Document limitation in skill
3. Focus on common use cases (basic parameters)

**Investigation Needed:**
```bash
# Test if these parameters are supported:
az cognitiveservices account deployment create \
  --name <account> \
  --resource-group <rg> \
  --deployment-name <deployment> \
  --model-name <model> \
  --model-version <version> \
  --model-format "OpenAI" \
  --sku-name "GlobalStandard" \
  --sku-capacity 10000 \
  --dynamic-throttling-enabled true  # ← Test this
  --rai-policy-name "Microsoft.DefaultV2"  # ← Test this
  --version-upgrade-option "OnceNewDefaultVersionAvailable"  # ← Test this
```

---

### 3. List RAI Policies

**Gap:** No command to list available RAI policies

**Workaround:** Use hardcoded common policies + allow custom input

**Status:** Acceptable (matches UX approach)

---

## Testing Checklist

### Basic Functionality
- [ ] Authenticate with Azure CLI
- [ ] Parse and verify project resource ID
- [ ] List available model versions
- [ ] Select model version (latest)
- [ ] Select SKU (GlobalStandard)
- [ ] Configure capacity (within range)
- [ ] Select RAI policy (default)
- [ ] Configure version upgrade policy
- [ ] Generate unique deployment name
- [ ] Review configuration
- [ ] Execute deployment (CLI command)
- [ ] Monitor deployment status
- [ ] Display final summary

### SKU Variants
- [ ] GlobalStandard deployment
- [ ] Standard deployment
- [ ] ProvisionedManaged (PTU) deployment

### Advanced Options
- [ ] Dynamic quota configuration (if supported)
- [ ] Priority processing configuration (if supported)
- [ ] Spillover deployment configuration (if supported)

### Error Handling
- [ ] Invalid model name
- [ ] Version not available
- [ ] Insufficient quota
- [ ] Capacity out of range
- [ ] Deployment name conflict
- [ ] Authentication failure
- [ ] Permission denied
- [ ] Deployment timeout

### Edge Cases
- [ ] First deployment (no existing deployments)
- [ ] Multiple existing deployments (name collision)
- [ ] Custom deployment name
- [ ] Minimum capacity (1K TPM or 50 PTU)
- [ ] Maximum capacity
- [ ] Project in different region
- [ ] Model not available in region

---

## Performance Considerations

### API Call Optimization

**Skill makes these API calls:**
1. `az account show` - Verify authentication (cached)
2. `az cognitiveservices account show` - Verify project (cached 5 min)
3. `az cognitiveservices account list-models` - Get versions (cached 5 min)
4. `az rest` (model capacities) - Get capacity range (cached 5 min)
5. `az cognitiveservices account deployment list` - Check existing names (cached 1 min)
6. `az cognitiveservices account deployment create` - Create deployment (real-time)
7. `az cognitiveservices account deployment show` - Monitor status (polling)

**Total API Calls:** ~7-10 (depending on monitoring duration)

**Optimization:**
- Cache project and model info
- Batch queries where possible
- Use appropriate stale times

---

## Future Enhancements

### When CLI Support Improves

**Monitor for:**
1. Native capacity query commands
2. Advanced deployment options in CLI
3. RAI policy listing commands
4. Improved deployment status monitoring

**Update Skill When Available:**
- Replace REST API calls with native CLI commands
- Update _TECHNICAL_NOTES.md
- Simplify implementation

### Additional Features

**Potential Additions:**
1. **PTU Calculator Script** - Interactive calculator for PTU estimation
2. **Batch Deployment** - Deploy multiple models at once
3. **Deployment Templates** - Save and reuse configurations
4. **Cost Estimation** - Show estimated costs before deployment
5. **Deployment Comparison** - Compare SKUs/capacities side-by-side

---

## Related UX Code Reference

**Primary Files:**
- `CustomizeDeployment.tsx` - Main component
- `SkuSelectorV2.tsx` - SKU selection UI
- `QuotaSlider.tsx` - Capacity configuration
- `VersionSettings.tsx` - Version and upgrade policy
- `GuardrailSelector.tsx` - RAI policy selection
- `DynamicQuotaToggle.tsx` - Dynamic quota UI
- `PriorityProcessingToggle.tsx` - Priority processing UI
- `SpilloverDeployment.tsx` - Spillover configuration
- `PtuCalculator.tsx` - PTU calculator

**Hooks:**
- `useGetDeploymentOptions.ts` - Deployment options hook
- `useCreateUpdateDeployment.tsx` - Deployment creation hook
- `useModelDeployments.ts` - List deployments hook
- `useCapacityValueFormat.ts` - Capacity formatting

**API:**
- `getDeploymentOptionsResolver.ts` - API resolver
- `getDeploymentOptions.ts` - Server route
- `getDeploymentOptionsUtils.ts` - Helper functions
- `createModelDeployment.ts` - Deployment creation route

---

## Change Log

| Date | Change | Reason | Author |
|------|--------|--------|--------|
| 2026-02-09 | Initial implementation | New skill creation | - |
| 2026-02-09 | Documented cascading selection pattern | UX alignment | - |
| 2026-02-09 | Documented CLI gaps | Known limitations | - |
| 2026-02-09 | Design decisions documented | Architecture clarity | - |

---

## Maintainer Notes

**Code Owner:** Azure AI Foundry Skills Team

**Last Review:** 2026-02-09

**Next Review:**
- When CLI adds capacity query commands
- When advanced deployment options are CLI-supported
- Quarterly review (2026-05-09)

**Questions/Issues:**
- Open issue in skill repository
- Contact: Azure AI Foundry Skills team

---

## References

**Azure Documentation:**
- [Azure OpenAI Service](https://learn.microsoft.com/azure/ai-services/openai/)
- [Model Deployments](https://learn.microsoft.com/azure/ai-services/openai/how-to/create-resource)
- [Provisioned Throughput](https://learn.microsoft.com/azure/ai-services/openai/how-to/provisioned-throughput)
- [Content Filtering](https://learn.microsoft.com/azure/ai-services/openai/concepts/content-filter)

**Azure CLI:**
- [Cognitive Services Commands](https://learn.microsoft.com/cli/azure/cognitiveservices)
- [REST API Reference](https://learn.microsoft.com/rest/api/cognitiveservices/)

**UX Codebase:**
- `azure-ai-foundry/app/components/models/CustomizeDeployment/`
- `azure-ai-foundry/app/hooks/useGetDeploymentOptions.ts`
- `azure-ai-foundry/app/routes/api/getDeploymentOptions.ts`
