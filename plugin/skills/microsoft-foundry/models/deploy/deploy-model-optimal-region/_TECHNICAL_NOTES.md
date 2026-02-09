# Technical Notes: deploy-model-optimal-region

> **Note:** This file is for audit and maintenance purposes only. It is NOT loaded during skill execution.

## CLI Gaps & API Usage

### 1. Model Capacity Checking

**Required Operation:** Query available capacity for a model across regions

**CLI Gap:** No native `az cognitiveservices` command exists

**Available Commands Investigated:**
- ❌ `az cognitiveservices account list-skus` - Lists SKU types (Standard, Free), not capacity
- ❌ `az cognitiveservices account list-usage` - Shows current usage, not available capacity
- ❌ `az cognitiveservices account list-models` - Lists supported models, no capacity info
- ❌ `az cognitiveservices account deployment list` - Lists existing deployments, no capacity
- ❌ `az cognitiveservices model` - Subgroup does not exist

**API Used:**
```
# Single region capacity check
GET /subscriptions/{sub}/providers/Microsoft.CognitiveServices/locations/{location}/modelCapacities
?api-version=2024-10-01
&modelFormat=OpenAI
&modelName=gpt-4o
&modelVersion=<version>

# Multi-region capacity check (subscription-wide)
GET /subscriptions/{sub}/providers/Microsoft.CognitiveServices/modelCapacities
?api-version=2024-10-01
&modelFormat=OpenAI
&modelName=gpt-4o
&modelVersion=<version>
```

**Implementation:**
```bash
# Check capacity in specific region
az rest --method GET \
  --url "https://management.azure.com/subscriptions/{SUB_ID}/providers/Microsoft.CognitiveServices/locations/{LOCATION}/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=gpt-4o&modelVersion=0613"

# Check capacity across all regions
az rest --method GET \
  --url "https://management.azure.com/subscriptions/{SUB_ID}/providers/Microsoft.CognitiveServices/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=gpt-4o&modelVersion=0613"
```

**Response Format:**
```json
{
  "value": [
    {
      "location": "eastus2",
      "properties": {
        "skuName": "GlobalStandard",
        "availableCapacity": 120000,
        "supportedDeploymentTypes": ["Deployment"]
      }
    }
  ]
}
```

**Source:**
- UX Code: `azure-ai-foundry/app/api/resolvers/listModelCapacitiesResolver.ts:32`
- UX Code: `azure-ai-foundry/app/api/resolvers/listModelCapacitiesByRegionResolver.ts:33`
- UX Code: `azure-ai-foundry/app/hooks/useModelCapacity.ts:112-178`

**Date Verified:** 2026-02-05

**Rationale:** ARM Management API is the only way to query model capacity. This is a newer feature not yet exposed in `az cognitiveservices` CLI. The API returns capacity per region per SKU, which is essential for determining where deployments can succeed.

---

### 2. Deployment Options Query

**Required Operation:** Get deployment options (SKUs, versions, capacity ranges) for a model

**CLI Gap:** No native command for deployment options/configuration

**API Used:**
```
POST /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/getDeploymentOptions
?api-version=2024-10-01
```

**Implementation:**
```bash
az rest --method POST \
  --url "https://management.azure.com/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.CognitiveServices/accounts/{ACCOUNT}/getDeploymentOptions?api-version=2024-10-01" \
  --body '{
    "model": {"name": "gpt-4o"},
    "sku": {"name": "GlobalStandard"}
  }'
```

**Response Format:**
```json
{
  "modelFormat": "OpenAI",
  "skuSupported": true,
  "sku": {
    "defaultSelection": "GlobalStandard",
    "options": ["GlobalStandard", "Standard"],
    "selectedSkuSupportedRegions": ["eastus2", "westus", "northeurope"]
  },
  "capacity": {
    "defaultSelection": 10000,
    "minimum": 1000,
    "maximum": 150000,
    "step": 1000
  },
  "deploymentLocation": "eastus2"
}
```

**Source:**
- UX Code: `azure-ai-foundry/app/api/resolvers/getDeploymentOptionsResolver.ts`
- UX Code: `azure-ai-foundry/app/routes/api/getDeploymentOptions.ts:75-100`
- UX Code: `azure-ai-foundry/app/hooks/useGetDeploymentOptions.ts`

**Date Verified:** 2026-02-05

**Rationale:** Deployment options API provides metadata (SKU support, version support, capacity limits) needed before deployment. This is a configuration API that returns what's valid for a given model/SKU combination in the context of a specific project. Not available via CLI.

---

### 3. Region Quota Availability (Multi-Version Models)

**Required Operation:** Check quota availability across regions for models with multiple versions

**CLI Gap:** No native command exists

**API Used:**
```
GET /subscriptions/{sub}/providers/Microsoft.CognitiveServices/locations/{location}/models
?api-version=2024-10-01
```

**Implementation:**
```bash
az rest --method GET \
  --url "https://management.azure.com/subscriptions/{SUB_ID}/providers/Microsoft.CognitiveServices/locations/{LOCATION}/models?api-version=2024-10-01" \
  --query "value[?name=='gpt-4o']"
```

**Source:**
- UX Code: `azure-ai-foundry/app/routes/api/getSubModelsRegionQuotaAvailability.ts`
- UX Code: `azure-ai-foundry/app/hooks/useSubModelsRegionQuotaAvailability.ts`
- UX Code: `azure-ai-foundry/app/components/models/NoSkuDialog/NoSkuDialog.tsx:114-167`

**Date Verified:** 2026-02-05

**Rationale:** For models with multiple versions (e.g., gpt-4o versions 0314, 0613, 1106), the API aggregates capacity across versions. The UI shows the maximum available capacity among all versions. This handles edge cases where different versions have different regional availability.

---

### 4. Model Deployment with GlobalStandard SKU

**Required Operation:** Deploy a model with GlobalStandard SKU

**CLI Support Status:** ✅ **NOW SUPPORTED** - The Azure CLI has been updated to support GlobalStandard SKU deployments.

**Updated Command:**
```bash
az cognitiveservices account deployment create \
  --name "account-name" \
  --resource-group "resource-group" \
  --deployment-name "gpt-4o-deployment" \
  --model-name "gpt-4o" \
  --model-version "2024-11-20" \
  --model-format "OpenAI" \
  --sku-name "GlobalStandard" \
  --sku-capacity 50
```

**Result:**
- ✅ **Now works correctly** - Deployment is created successfully
- ✅ **Native CLI support** - No need for REST API workaround
- ✅ **Proper error handling** - Returns meaningful errors on failure

**Historical Note (Deprecated):**

Prior to the CLI update, the `--sku-name "GlobalStandard"` parameter silently failed:
- ❌ Command exited with success (exit code 0) but deployment was NOT created
- ❌ No error message - Appeared to succeed but deployment didn't exist
- ✅ Only "Standard" and "Manual" were supported at that time

This required using ARM REST API as a workaround:

**Old API Workaround (No Longer Needed):**
```
PUT /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/deployments/{deploymentName}
?api-version=2024-10-01
```

**Implementation - Old Bash Script (Deprecated):**

The `scripts/deploy_via_rest.sh` script was created to work around the CLI limitation:

```bash
#!/bin/bash
# This script is NO LONGER NEEDED - Azure CLI now supports GlobalStandard
# Kept for historical reference only

# Usage: deploy_via_rest.sh <subscription-id> <resource-group> <account-name> <deployment-name> <model-name> <model-version> <capacity>

SUBSCRIPTION_ID="$1"
RESOURCE_GROUP="$2"
ACCOUNT_NAME="$3"
DEPLOYMENT_NAME="$4"
MODEL_NAME="$5"
MODEL_VERSION="$6"
CAPACITY="$7"

API_URL="https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$ACCOUNT_NAME/deployments/$DEPLOYMENT_NAME?api-version=2024-10-01"

PAYLOAD=$(cat <<EOF
{
  "properties": {
    "model": {
      "format": "OpenAI",
      "name": "$MODEL_NAME",
      "version": "$MODEL_VERSION"
    },
    "versionUpgradeOption": "OnceNewDefaultVersionAvailable",
    "raiPolicyName": "Microsoft.DefaultV2"
  },
  "sku": {
    "name": "GlobalStandard",
    "capacity": $CAPACITY
  }
}
EOF
)

az rest --method PUT --url "$API_URL" --body "$PAYLOAD"
```

**Why the Old Script Was Used:**
- **JSON payload construction** - Complex, required proper escaping and variable substitution
- **Error-prone** - Easy to make mistakes with quotes and formatting
- **Reusable** - Script could be called multiple times with different parameters
- **Testable** - Could be tested independently
- **Follows pattern** - Similar to `azure-postgres` scripts for complex operations

**Payload Structure (Historical):**
```json
{
  "properties": {
    "model": {
      "format": "OpenAI",
      "name": "gpt-4o",
      "version": "2024-11-20"
    },
    "versionUpgradeOption": "OnceNewDefaultVersionAvailable",
    "raiPolicyName": "Microsoft.DefaultV2"
  },
  "sku": {
    "name": "GlobalStandard",
    "capacity": 50
  }
}
```

**Source:**
- UX Code: `azure-ai-foundry/app/api/resolvers/createOrUpdateModelDeploymentResolver.ts:38-60`
- UX Code: `azure-ai-foundry/app/routes/api/createModelDeployment.ts:125-161`
- UX Code: `azure-ai-foundry/app/hooks/useModelDeployment.ts:211-235`
- Original Testing: Verified 2026-02-05 with REST API workaround
- CLI Update Verified: 2026-02-09 with native CLI support

**Date Original Workaround Created:** 2026-02-05

**Date CLI Updated:** 2026 (exact date unknown, confirmed working as of 2026-02-09)

**Rationale for Change:** The Azure CLI's `az cognitiveservices account deployment create` command has been updated to properly support GlobalStandard SKU. The previous limitation no longer exists, and the native CLI command should now be used instead of the REST API workaround. This simplifies the implementation and aligns with standard Azure CLI patterns used across other Azure skills.

---

## Implementation Patterns Used

### Pattern: Pure CLI Documentation (87% of Azure skills)

**Rationale:**
- No complex parsing needed
- Azure CLI handles JSON output/querying with `--query` (JMESPath)
- Claude can execute commands directly during skill invocation
- Easier to maintain and understand
- Users can copy commands for manual execution

**Reference Skills:**
- `azure-quick-review` (documentation + MCP tools)
- `azure-deploy` (recipe-based documentation)
- `entra-app-registration` (comprehensive CLI examples)
- `azure-security` (reference-heavy documentation)
- `azure-validate` (step-by-step CLI workflows)

**Skills Analyzed:** 23 total Azure skills
- **20 skills (87%)**: Pure documentation, no scripts
- **1 skill (4%)**: Bash scripts (azure-postgres - for complex DB setup)
- **1 skill (4%)**: Python scripts (azure-cost-estimation - for template parsing)
- **1 skill (4%)**: PowerShell examples (appinsights-instrumentation)

### Pattern: Bash Scripts (13% of skills)

**When Used:** Only when complex multi-step orchestration with error handling is needed

**Example:** `azure-postgres/scripts/setup-managed-identity.sh` (158 lines)
- 7-step workflow with validation at each step
- Uses `set -e` for error propagation
- Complex psql operations with role creation
- Environment variable management
- Permission granting with error recovery

**Applied in This Skill:**
- **DEPRECATED: `scripts/deploy_via_rest.sh`** - Bash script for ARM REST API deployment
  - ⚠️ **No longer needed** - Azure CLI now supports GlobalStandard natively
  - Originally encapsulated complex JSON payload construction
  - Provided proper error handling and validation
  - 50 lines with parameter validation
  - Followed `azure-postgres` pattern for CLI wrappers
  - **Use native CLI command instead** (see SKILL.md Phase 7)

**Why Minimal Scripts (Option B):**
- **Deployment operation is complex** - JSON payload construction is error-prone
- **Reusable** - Same script used every time a deployment is created
- **Token-efficient** - Script can be executed without loading into context
- **Maintainable** - Single source of truth for deployment payload structure
- **Testable** - Can be tested independently from skill execution

### Pattern: Python Scripts (4% of skills)

**When Used:** Complex parsing, calculations, or API interactions

**Example:** `azure-cost-estimation/scripts/cost_calculator.py` (1,442 lines)
- Regex-based Bicep/ARM template parsing
- Azure Retail Prices API integration
- Complex cost calculations for 15+ resource types
- Dataclass models for structured data
- Report generation with markdown formatting

**Not Applicable Here Because:**
- No template parsing required
- ARM APIs return structured JSON
- No complex calculations (capacity is direct numeric comparison)
- No report generation needed

---

## Design Decisions

### 1. No Region Ranking Algorithm

**Decision:** Show available vs unavailable regions (2-tier list), no scoring

**Rationale:**
- Follows NoSkuDialog.tsx pattern exactly (lines 170-209)
- Simpler UX - user chooses based on displayed capacity, not opaque algorithm
- Avoids complex weighting/scoring that may not match user priorities
- Transparent to user - they see exact capacity numbers
- User may have business requirements (data residency, compliance) that override capacity

**Alternative Considered:**
- Scoring algorithm (40% capacity, 30% proximity, 20% support, 10% latency)
- **Rejected because:** UX doesn't do this, adds complexity without clear value

**Source:** `azure-ai-foundry/app/components/models/NoSkuDialog/NoSkuDialog.tsx:170-209`

**Implementation:**
```typescript
// UX splits into two arrays:
const [availableRegions, unavailableRegions] = useMemo(() => {
  const regionsWithCapacity = new Set(
    [...capacityByRegion.entries()]
      .filter(([, capacity]) => capacity.properties?.availableCapacity > 0)
      .flatMap(([region]) => region)
  );
  return [
    locationOptions.filter(option => regionsWithCapacity?.has(option.id)),
    locationOptions.filter(option => !regionsWithCapacity?.has(option.id))
  ];
}, [locations, capacityByRegion]);
```

### 2. Default SKU: GlobalStandard

**Decision:** Use GlobalStandard as default, document other SKUs for future extension

**Rationale:**
- Multi-region load balancing
- Best availability across Azure
- Recommended for production workloads
- Matches UX default selection
- Microsoft's strategic direction for AI services

**Other SKUs Available:**
- Standard - Single region, lower cost
- ProvisionedManaged - Reserved capacity with PTUs
- DataZoneStandard - Data zone isolation
- DeveloperTier - Development/testing only

**Source:** `azure-ai-foundry/app/components/models/NoSkuDialog/NoSkuDialog.tsx:74`

**Future Extension:** Add `--sku` parameter to skill for advanced users

### 3. Capacity Display Format

**Decision:** Show formatted capacity (e.g., "120K TPM" instead of "120000")

**Rationale:**
- Human-readable
- Consistent with UX display
- Format: thousands → "K", millions → "M"
- Includes unit label (TPM = Tokens Per Minute)

**Format Logic:**
```javascript
// UX implementation
const formatValue = (value: number) => {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'K';
  return value.toString();
};
```

**Source:** `azure-ai-foundry/app/hooks/useCapacityValueFormat.ts:306-310`

**Display Examples:**
- 1000 → "1K TPM"
- 120000 → "120K TPM"
- 1500000 → "1.5M TPM"

### 4. Project Creation Support

**Decision:** Allow creating new projects in selected region

**Rationale:**
- User may not have project in optimal region
- Follows NoSkuDialog pattern exactly (lines 256-328)
- Reduces friction - no need to leave skill to create project
- Common scenario: optimal region is different from current project

**Implementation Steps:**
1. Check if projects exist in selected region
2. If no projects: Show "Create new project" option
3. Collect: project name, resource group, service name
4. Use `az cognitiveservices account create` with `kind=AIProject`
5. Wait for provisioning completion
6. Continue with deployment to new project

**Source:** `azure-ai-foundry/app/components/models/NoSkuDialog/NoSkuDialog.tsx:256-328`

**Alternative Considered:**
- Require user to create project manually first
- **Rejected because:** Creates friction, UX supports inline creation

### 5. Check Current Region First

**Decision:** Always check current project's region for capacity before showing region selection

**Rationale:**
- If current region has capacity, deploy immediately (fast path)
- Only show region selection if needed (reduces cognitive load)
- Matches UX behavior in NoSkuDialog
- Most deployments will succeed in current region

**Flow:**
```
1. Get current project → Extract region
2. Check capacity in current region
3. IF capacity > 0:
     → Deploy directly (no region selection)
4. ELSE:
     → Show message: "Current region has no capacity"
     → Show region selection with alternatives
```

**Source:** `azure-ai-foundry/app/components/models/NoSkuDialog/NoSkuDialog.tsx:340-346`

### 6. Region Filtering by Capacity

**Decision:** Show two groups - "Available Regions" (enabled) and "Unavailable Regions" (disabled)

**Rationale:**
- User sees all regions, understands full picture
- Disabled regions show WHY they're unavailable:
  - "Model not supported in this region"
  - "Insufficient quota - 0 TPM available"
- Follows accessibility best practice (don't hide, disable with reason)
- Matches UX implementation exactly

**Display Pattern:**
```
Available Regions:
✓ East US 2 - 120K TPM
✓ Sweden Central - 100K TPM
✓ West US - 80K TPM

Unavailable Regions:
✗ North Europe (Model not supported)
✗ France Central (Insufficient quota - 0 TPM)
✗ UK South (Model not supported)
```

**Source:** `azure-ai-foundry/app/components/models/NoSkuDialog/NoSkuDialog.tsx:394-413`

### 7. Deployment Name Generation

**Decision:** Auto-generate deployment name as `{model}-{timestamp}`

**Rationale:**
- User doesn't need to think of a name
- Guaranteed uniqueness via timestamp
- Descriptive (includes model name)
- Pattern: `gpt-4o-20260205-143022`

**Format:**
```bash
MODEL_NAME="gpt-4o"
DEPLOYMENT_NAME="${MODEL_NAME}-$(date +%Y%m%d-%H%M%S)"
# Result: gpt-4o-20260205-143022
```

**Validation Rules:**
- Alphanumeric, dots, hyphens only
- 2-64 characters
- Regex: `^[\w.-]{2,64}$`

**Conflict Handling:**
- If name exists: Append random suffix
- Example: `gpt-4o-20260205-143022-a7b3`

### 8. Model Version Selection

**Decision:** Use latest stable version by default, support version override

**Rationale:**
- Latest version has newest features
- No need to prompt user for version (reduces friction)
- Advanced users can specify with `--version` parameter
- Matches UX behavior (version dropdown shows latest as default)

**Source:** `azure-ai-foundry/app/utils/versionUtils.ts:getDefaultVersion`

**Version Priority:**
1. User-specified version (if provided)
2. Latest stable version (from model catalog)
3. Fall back to model's default version

---

## API Versions Used

| API | Version | Status | Stability |
|-----|---------|--------|-----------|
| Model Capacities | 2024-10-01 | GA | Stable |
| Deployment Create | 2024-10-01 | GA | Stable |
| Deployment Options | 2024-10-01 | GA | Stable |
| Cognitive Services Account | 2024-10-01 | GA | Stable |

**Source:** `azure-ai-foundry/app/api/constants/cogsvcDeploymentApiVersion.ts`

**API Version Constant:**
```typescript
export const COGSVC_DEPLOYMENT_API_VERSION = '2024-10-01';
```

**When to Update:**
- New API version becomes available with additional features
- Deprecation notice for current version
- Breaking changes announced

---

## Error Handling Patterns

### 1. Authentication Errors

**Scenario:** User not logged into Azure CLI

**Detection:**
```bash
az account show 2>&1 | grep "Please run 'az login'"
```

**Response:**
```
❌ Not logged into Azure

Please authenticate with Azure CLI:
  az login

After login, re-run the skill.
```

### 2. Insufficient Quota (All Regions)

**Scenario:** No regions have available capacity

**Detection:** All regions return `availableCapacity: 0`

**Response:**
```
⚠ Insufficient Quota in All Regions

No regions have available capacity for gpt-4o with GlobalStandard SKU.

Next Steps:
1. Request quota increase:
   https://portal.azure.com/#view/Microsoft_Azure_Capacity/QuotaMenuBlade

2. Check existing deployments (may be using quota):
   az cognitiveservices account deployment list \
     --name <project> \
     --resource-group <rg>

3. Consider alternative models:
   • gpt-4o-mini (lower capacity requirements)
   • gpt-35-turbo (smaller model)
```

**Source:** `azure-ai-foundry/app/components/models/CustomizeDeployment/ErrorState.tsx`

### 3. Deployment Name Conflict

**Scenario:** Deployment name already exists

**Detection:** API returns `409 Conflict` or error message contains "already exists"

**Resolution:**
```bash
# Append random suffix and retry
DEPLOYMENT_NAME="${MODEL_NAME}-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 2)"
```

### 4. Model Not Supported

**Scenario:** Model doesn't exist or isn't available in any region

**Detection:** API returns empty capacity list or 404

**Response:**
```
❌ Model Not Found

The model "gpt-5" is not available in any region.

Available models:
  az cognitiveservices account list-models \
    --name <project> \
    --resource-group <rg>
```

### 5. Region Unavailable

**Scenario:** Selected region doesn't support the model

**Detection:** `availableCapacity: undefined` or `skuSupported: false`

**Response:**
```
⚠ Model Not Supported in East US

The model gpt-4o is not supported in East US.

Please select an alternative region from the available list.
```

---

## Future Considerations

### CLI Updates - Capacity Checking Commands

**Monitor for CLI updates that might add:**
- `az cognitiveservices model capacity list` - Query capacity across regions
- `az cognitiveservices deployment options get` - Get deployment configuration
- `az cognitiveservices deployment validate` - Pre-validate deployment before creating

**Current Status:**
- ✅ **GlobalStandard SKU deployment** - Now supported natively (as of 2026)
- ❌ **Capacity checking** - Still requires REST API
- ❌ **Deployment options** - Still requires REST API

**Action Items When CLI Commands Become Available:**
1. Update skill to use native CLI commands for capacity checking
2. Remove `az rest` usage for capacity queries where possible
3. Update `_TECHNICAL_NOTES.md` to reflect CLI availability
4. Test backward compatibility

**Tracking Locations:**
- Azure CLI GitHub: https://github.com/Azure/azure-cli
- Cognitive Services extension: https://github.com/Azure/azure-cli-extensions/tree/main/src/cognitiveservices
- Release notes: https://learn.microsoft.com/en-us/cli/azure/release-notes-azure-cli

### API Version Updates

**When to Update:**
- New features needed (e.g., PTU deployments, model router)
- Deprecation warning for 2024-10-01
- Breaking changes in API contract

**Change Process:**
1. Review API changelog
2. Test with new API version in non-production
3. Update `COGSVC_DEPLOYMENT_API_VERSION` constant
4. Update skill documentation
5. Test all workflows
6. Document changes in this file

### Additional Features to Consider

1. **Multi-Model Deployment**
   - Deploy multiple models in one operation
   - Batch region optimization

2. **Cost Optimization**
   - Show pricing per region
   - Recommend cheapest region with capacity

3. **Deployment Templates**
   - Save common deployment configurations
   - Quick re-deploy with templates

4. **Monitoring Integration**
   - Set up alerts on deployment
   - Configure Application Insights

5. **SKU Selection**
   - Support all SKU types (not just GlobalStandard)
   - PTU calculator integration
   - Reserved capacity pricing

---

## Related UX Code Reference

**Primary Components:**
- `azure-ai-foundry/app/components/models/NoSkuDialog/NoSkuDialog.tsx` - Region selection UI
- `azure-ai-foundry/app/components/models/CustomizeDeployment/CustomizeDeployment.tsx` - Deployment configuration
- `azure-ai-foundry/app/components/models/DeployMenuButton/DeployMenuButton.tsx` - Deployment entry points

**Hooks:**
- `azure-ai-foundry/app/hooks/useModelCapacity.ts` - Capacity checking
- `azure-ai-foundry/app/hooks/useModelDeploymentWithDialog.tsx` - Deployment orchestration
- `azure-ai-foundry/app/hooks/useGetDeploymentOptions.ts` - Deployment options fetching
- `azure-ai-foundry/app/hooks/useCapacityValueFormat.ts` - Capacity formatting

**API Resolvers:**
- `azure-ai-foundry/app/api/resolvers/listModelCapacitiesResolver.ts` - Multi-region capacity
- `azure-ai-foundry/app/api/resolvers/listModelCapacitiesByRegionResolver.ts` - Single region capacity
- `azure-ai-foundry/app/api/resolvers/getDeploymentOptionsResolver.ts` - Deployment options
- `azure-ai-foundry/app/api/resolvers/createModelDeploymentResolver.ts` - Deployment creation

**Utilities:**
- `azure-ai-foundry/app/utils/locationUtils.ts:normalizeLocation` - Region name normalization
- `azure-ai-foundry/app/utils/versionUtils.ts:getDefaultVersion` - Version selection logic
- `azure-ai-foundry/app/routes/api/getDeploymentOptionsUtils.ts` - Deployment validation helpers

---

## Change Log

| Date | Change | Reason | Author |
|------|--------|--------|--------|
| 2026-02-05 | Initial implementation | New skill creation | - |
| 2026-02-05 | Documented CLI gaps | Audit requirement | - |
| 2026-02-05 | Added design decisions | Architecture documentation | - |
| 2026-02-05 | Added UX code references | Traceability to source implementation | - |
| 2026-02-09 | Updated to use native CLI for GlobalStandard | Azure CLI now supports GlobalStandard SKU | - |
| 2026-02-09 | Deprecated REST API workaround scripts | Native CLI support available | - |

---

## Maintainer Notes

**Code Owner:** Azure AI Foundry Skills Team

**Last Review:** 2026-02-05

**Next Review:**
- When CLI commands are added for capacity checking
- When API version changes
- Quarterly review (2026-05-05)

**Questions/Issues:**
- Open issue in skill repository
- Contact: Azure AI Foundry Skills team

**Testing Checklist:**
- [ ] Authentication flow
- [ ] Current region has capacity (fast path)
- [ ] Current region lacks capacity (region selection)
- [ ] No projects in selected region (project creation)
- [ ] Deployment success
- [ ] Deployment failure (quota exceeded)
- [ ] Model not found error
- [ ] Name conflict handling
- [ ] Multi-version model handling

---

## References

**Azure Documentation:**
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Cognitive Services REST API](https://learn.microsoft.com/en-us/rest/api/cognitiveservices/)
- [Azure CLI - Cognitive Services](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices)

**Internal Documentation:**
- UX Codebase: `azure-ai-foundry/app/`
- Skill Framework: `skills/skills/skill-creator/`
- Other Azure Skills: `GitHub-Copilot-for-Azure/plugin/skills/`

**External Resources:**
- Azure CLI GitHub: https://github.com/Azure/azure-cli
- Azure CLI Extensions: https://github.com/Azure/azure-cli-extensions
