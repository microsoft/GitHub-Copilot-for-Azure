---
name: check-model-availability
description: |
  **TROUBLESHOOTING SKILL** - Check regional availability of AI models in Microsoft Foundry (Azure AI Foundry / Azure OpenAI).
  USE FOR: model availability, "is model available", "which regions have", model not found, model not supported, region support, deploy model to region, SKU not available, version not available, capacity check, "can I deploy", model rollout, regional availability, compare regions.
  DO NOT USE FOR: deploying models (use microsoft-foundry), rate limiting/429 errors (use diagnose-429-errors), quota increase requests (use diagnose-429-errors), authentication errors (use microsoft-foundry rbac).
  INVOKES: `azure__foundry` (model catalog, deployments), `mcp__plugin_azure_azure__quota` (capacity) MCP tools for diagnostics.
  FOR CLI USERS: Azure CLI fallback documented for each step.
---

# Check Model Availability in Microsoft Foundry

Guide for checking regional availability of AI models, understanding deployment constraints, and selecting optimal regions for model deployments.

## Quick Reference

| Property | Value |
|----------|-------|
| **Key CLI Commands** | `az cognitiveservices model list --location`, `az cognitiveservices account list-skus` |
| **MCP Tools** | `foundry_models_list`, `quota_usage_check` |
| **Availability Factors** | Region, model version, SKU type, capacity |
| **Common Issue** | Model exists but not in project's region |
| **Best For** | Pre-deployment planning, troubleshooting "model not found" errors |

## When to Use

- **Check if a model is available** in a specific region
- **Find regions** that support a specific model
- **Troubleshoot deployment failures** due to "model not found" or "SKU not available"
- **Plan multi-region deployments** for capacity or redundancy
- Answer questions like "Can I deploy GPT-4.1 in West Europe?"

**Workflow:** Diagnose availability → Present options via AskUserQuestion → Guide next steps

## Understanding Availability

Model availability depends on multiple factors that must all be satisfied:

| Factor | Description | Check Method |
|--------|-------------|--------------|
| **Region** | Model must be available in region | `foundry_models_list` |
| **SKU Type** | Deployment tier (Standard, GlobalStandard, etc.) | Model capacity API |
| **Version** | Specific version (e.g., 2024-05-13) | `foundry_models_list` |
| **Capacity** | Available quota in region | `quota_usage_check` |

For the detailed 4-phase validation flow and API responses, see [references/model-availability-flow.md](references/model-availability-flow.md).

## Diagnostic Workflow

### Step 1: Check Model Availability in Target Region

**Using MCP Tools (Preferred):**

Use `azure__foundry` MCP tool with command `foundry_models_list`:
- Parameters: `region` (e.g., "eastus")
- Filter results for the specific model name
- Returns: Model name, version, kind, lifecycle status

**If Azure MCP is not enabled:** Run `/mcp add azure` or enable via `/mcp`.

**CLI Fallback:**
```bash
# Check if model is available in a specific region
az cognitiveservices model list \
  --location <region> \
  --query "[?name=='<model-name>'].{Name:name, Version:version, Status:lifecycleStatus}" \
  --output table

# Example: Check GPT-4o in West Europe
az cognitiveservices model list \
  --location westeurope \
  --query "[?contains(name, 'gpt-4o')].{Name:name, Version:version, Status:lifecycleStatus}" \
  --output table
```

**If empty result:** Model is NOT available in that region. Proceed to Step 2.

### Step 2: Find Regions Where Model Is Available

If the model isn't in the target region, find alternative regions.

**CLI Approach:**
```bash
# Check multiple regions for model availability
MODEL_NAME="gpt-4o"

for region in eastus eastus2 westus westeurope northeurope southeastasia; do
  result=$(az cognitiveservices model list \
    --location "$region" \
    --query "[?name=='$MODEL_NAME']" \
    --output tsv 2>/dev/null)

  if [ -n "$result" ]; then
    echo "$region: Available"
  else
    echo "$region: Not available"
  fi
done
```

### Step 3: Check SKU and Version Availability

Not all SKUs are available in all regions. Check specific SKU support.

**CLI Fallback:**
```bash
# List available model versions in a region
az cognitiveservices model list \
  --location <region> \
  --query "[?name=='<model-name>'].{Model:name, Version:version, Format:format}" \
  --output table

# Check SKU availability
az cognitiveservices account list-skus \
  --kind CognitiveServices \
  --location <region> \
  --output table
```

### Step 4: Check Capacity Availability

Even if model and SKU are available, capacity may be exhausted.

**Using MCP Tools (Preferred):**

Use `mcp__plugin_azure_azure__quota` MCP tool with command `quota_usage_check`:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `region` | Yes | Azure region (e.g., "eastus2") |
| `resource-types` | Yes | `"Microsoft.CognitiveServices/accounts"` |
| `subscription` | Yes | Subscription ID or name (omit only if `AZURE_SUBSCRIPTION_ID` env var is set) |

- Returns: Current allocation vs. regional limit

**CLI Fallback:**
```bash
# Check regional quota for a model
az cognitiveservices usage list \
  --location <region> \
  --query "[?contains(name.value, '<model-name>')].{Name:name.value, Current:currentValue, Limit:limit}" \
  --output table
```

### Step 5: Present Options to User

**IMPORTANT:** Use `AskUserQuestion` to present options based on findings:

- **Model available, capacity available** → Proceed with deployment
- **Model available, no capacity** → Request quota increase or try different region
- **Model not in region** → Suggest alternative regions or wait for rollout
- **SKU not supported** → Suggest alternative SKU or region

## Six Reasons for Unavailability

| Reason | Symptom | Quick Resolution |
|--------|---------|------------------|
| **1. Not in subscription** | Model doesn't appear anywhere | Request access from Azure support |
| **2. Not in region** | Available elsewhere, not in project region | Deploy to supported region |
| **3. SKU not supported** | Model exists but SKU isn't | Use different SKU (e.g., Standard instead of GlobalStandard) |
| **4. No quota** | `availableCapacity === 0` | Request quota increase, wait for refresh |
| **5. Version unavailable** | Specific version not in region | Use available version |
| **6. Deployment type constraint** | ProvisionedManaged requires approval | Use Standard tier or request approval |

For detailed explanations of each reason, see [references/model-availability-flow.md](references/model-availability-flow.md#six-reasons-for-model-unavailability).

## Common Issues & Quick Fixes

| Issue | Cause | Resolution |
|-------|-------|------------|
| "Model not found" error | Model not in region | Check availability with CLI, try different region |
| Deployment stuck "Creating" | Region at capacity | Wait or deploy to alternative region |
| Version unavailable | Staggered rollout | Use latest GA version, check preview regions |
| "SKU not available" error | SKU not in region | Check SKU availability, use Standard (S0) |
| Free tier unavailable | F0 not in region | Use paid tier or different region |

## Diagnostic Checklist

- [ ] Verify model name and version are correct
- [ ] Check model availability in target region (`foundry_models_list`)
- [ ] If not available, find regions where model exists
- [ ] Verify SKU type is supported in region
- [ ] Check capacity/quota availability
- [ ] Consider GA vs Preview status (Preview = limited regions)
- [ ] **Present options to user via AskUserQuestion**

## Regional Capacity Considerations

| Region | Demand Level | Notes |
|--------|--------------|-------|
| **East US** | Very High | Most popular, may hit capacity limits |
| **West Europe** | High | Popular for European workloads |
| **Southeast Asia** | Medium | Growing demand |
| **Australia East** | Low-Medium | Good availability |

**Multi-Region Strategy:**
- Deploy identical models in 2-3 regions for redundancy
- Primary: closest to users (latency)
- Failover: alternative with confirmed availability

## Additional Resources

- [Azure OpenAI Model Availability](https://learn.microsoft.com/azure/cognitive-services/openai/concepts/models)
- [Model Lifecycle and Deprecation](https://learn.microsoft.com/azure/cognitive-services/openai/concepts/model-retirements)
- [Azure OpenAI Service Quotas](https://learn.microsoft.com/azure/cognitive-services/openai/quotas-limits)
- **Detailed Flow:** See [references/model-availability-flow.md](references/model-availability-flow.md)
