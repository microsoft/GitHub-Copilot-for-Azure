---
name: check-model-availability
description: |
  **TROUBLESHOOTING SKILL** - Check regional availability of AI models in Microsoft Foundry (Azure AI Foundry / Azure OpenAI).
  USE FOR: model availability, "is model available", "which regions have", model not found, model not supported, region support, deploy model to region, SKU not available, version not available, capacity check, "can I deploy", model rollout, regional availability, compare regions, "in what regions can I deploy", "where can I deploy".
  DO NOT USE FOR: deploying models (use microsoft-foundry), rate limiting/429 errors (use diagnose-429-errors), quota increase requests (use diagnose-429-errors), authentication errors (use microsoft-foundry rbac).
  INVOKES: Capacity discovery scripts from models/deploy-model/capacity, MCP tools for quick checks.
  FOR CLI USERS: Uses shared scripts; CLI fallback documented for each step.
---

# Check Model Availability in Microsoft Foundry

Guide for checking regional availability of AI models, understanding deployment constraints, and selecting optimal regions for model deployments.

## Quick Reference

| Property | Value |
|----------|-------|
| **Primary Tool** | Capacity discovery scripts (see [capacity skill](../models/deploy-model/capacity/SKILL.md)) |
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

**Workflow:** Get subscription context → Check actual availability → Present personalized options

> **⚠️ CRITICAL:** NEVER give generic "you may need to apply for access" advice before checking the user's actual subscription. Users may already have access, and generic advice wastes time and causes confusion. Always check their subscription first.

## Understanding Availability

Model availability depends on multiple factors that must all be satisfied:

| Factor | Description | Check Method |
|--------|-------------|--------------|
| **Region** | Model must be available in region | Capacity scripts or `foundry_models_list` |
| **SKU Type** | Deployment tier (Standard, GlobalStandard, etc.) | Capacity scripts |
| **Version** | Specific version (e.g., 2024-05-13) | Capacity scripts |
| **Capacity** | Available quota in region | `quota_usage_check` or capacity scripts |

For the detailed 4-phase validation flow and API responses, see [references/model-availability-flow.md](references/model-availability-flow.md).

## Prerequisites

Before calling quota tools, you MUST have the subscription ID. **Prompt the user using AskUserQuestion:**

```
AskUserQuestion:
  question: "How would you like to provide your Azure subscription?"
  header: "Subscription"
  options:
    - label: "Auto-detect with MCP"
      description: "I'll use Azure MCP to get your current subscription"
    - label: "Auto-detect with CLI"
      description: "I'll use Azure CLI (az account show) to get your subscription"
    - label: "Help me find it"
      description: "I have multiple subscriptions or need help locating the right one"
```

**Based on user selection:**

| Selection | Action |
|-----------|--------|
| **Auto-detect with MCP** | Call `azure__subscription` → `subscriptions_get_current` |
| **Auto-detect with CLI** | Run `az account show --query id -o tsv` |
| **Help me find it** | Call `azure__subscription` → `subscriptions_list` to show all subscriptions, then prompt user to select one |

> **Why this matters:** The `quota_region_availability_list` MCP command fails with "missing required parameters" if subscription ID is not provided. Always gather subscription context before calling quota-related tools.

## Diagnostic Workflow

This skill uses the **capacity discovery scripts** from the [deploy-model/capacity skill](../models/deploy-model/capacity/SKILL.md) for availability checks. The scripts handle the complex REST API calls and multi-region searches.

> **IMPORTANT WORKFLOW ORDER:** Always check the user's actual subscription BEFORE giving any generic information about access requirements. The user may already have access to preview/limited models.

### Step 1: Get Subscription Context FIRST

**Before doing anything else**, get the user's subscription. This enables personalized availability checks.

Use AskUserQuestion to prompt for subscription method (see Prerequisites section above), then retrieve it.

**Why this is Step 1:** Checking subscription quota reveals whether the user already has access to limited/preview models. Never tell users they "need to apply for access" without first checking their subscription.

### Step 2: Check User's Actual Quota (Preview/Limited Models)

For preview or limited-access models (like gpt-image-1), check the user's subscription quota FIRST:

**MCP Command (exact):**
```
azure__quota → quota_usage_check
  parameters: {
    "subscription": "<subscription-id>",
    "region": "eastus",  # Try known regions for the model
    "resource-types": "Microsoft.CognitiveServices/accounts"
  }
```

**Interpret results:**
- If quota shows `limit > 0` for the model → User HAS access, proceed with deployment guidance
- If quota shows `limit = 0` or model not in results → User may need to apply for access

**Only if user lacks access**, then search documentation for access application details:
```
azure__documentation → microsoft_docs_search
  parameters: { "query": "<model-name> Azure OpenAI access application" }
```

### Step 3: Quick Catalog Check with MCP (Single Region)

For a quick catalog check in a single region, use the MCP tools:

**MCP Command (exact):**
```
azure__foundry → foundry_models_list
  parameters: {
    "region": "eastus",        # Optional: specific region
    "model-name": "gpt-4o"     # Optional: filter by model name
  }
```

- Returns: Model name, version, kind, lifecycle status
- Filter results for the specific model name if `model-name` param not used

**If Azure MCP is not enabled:** Run `/mcp add azure` or enable via `/mcp`.

### Step 4: Multi-Region Discovery (Use Capacity Scripts)

For finding which regions support a model or comparing availability across regions, use the capacity discovery scripts.

**Scripts Location:** `models/deploy-model/capacity/scripts/`

| Script | Purpose |
|--------|---------|
| `query_capacity.ps1` / `query_capacity.sh` | Check model availability and list versions |
| `discover_and_rank.ps1` / `discover_and_rank.sh` | Full discovery: capacity + projects + ranking |

**Usage:**
```powershell
# Check if model is available and list versions
.\models\deploy-model\capacity\scripts\query_capacity.ps1 -ModelName <model-name>

# Full discovery with capacity requirements
.\models\deploy-model\capacity\scripts\discover_and_rank.ps1 -ModelName <model-name> -ModelVersion <version> -MinCapacity <target>
```
```bash
# Check if model is available and list versions
./models/deploy-model/capacity/scripts/query_capacity.sh <model-name>

# Full discovery with capacity requirements
./models/deploy-model/capacity/scripts/discover_and_rank.sh <model-name> <version> <min-capacity>
```

> 💡 The scripts automatically query capacity across ALL regions, cross-reference with the user's existing projects, and output a ranked table.

For the full workflow details, see [capacity/SKILL.md](../models/deploy-model/capacity/SKILL.md).

### Step 5: Detailed Quota Check (Multi-Region)

For comprehensive quota analysis across multiple regions (you should already have the subscription from Step 1):

**MCP Command (exact):**
```
azure__quota → quota_usage_check
  parameters: {
    "subscription": "<subscription-id>",  # REQUIRED - get first!
    "region": "eastus2",
    "resource-types": "Microsoft.CognitiveServices/accounts"
  }
```

**For multi-region availability:**
```
azure__quota → quota_region_availability_list
  parameters: {
    "subscription": "<subscription-id>",  # REQUIRED
    "resource-types": "Microsoft.CognitiveServices/accounts",
    "cognitive-service-model-name": "gpt-4o"  # Optional
  }
```

- Returns: Current allocation vs. regional limit

**CLI Fallback:**
```bash
az cognitiveservices usage list \
  --location <region> \
  --query "[?contains(name.value, '<model-name>')].{Name:name.value, Current:currentValue, Limit:limit}" \
  --output table
```

### Step 6: Present Options to User

**IMPORTANT:** Use `AskUserQuestion` to present options based on findings:

- **Model available, capacity available** → Proceed with deployment (hand off to [preset](../models/deploy-model/preset/SKILL.md) or [customize](../models/deploy-model/customize/SKILL.md))
- **Model available, no capacity** → Request quota increase or try different region (see [quota skill](../quota/quota.md))
- **Model not in region** → Suggest alternative regions from discovery results
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

## Common Pitfalls (From Session Analysis)

| Pitfall | What Happens | Prevention |
|---------|--------------|------------|
| **Giving generic "apply for access" advice before checking subscription** | User told to apply for access they already have; wastes time, causes confusion | ALWAYS check user's subscription quota FIRST (Step 2). Only mention access applications if quota check shows no access. |
| **Calling quota tools without subscription** | `quota_region_availability_list` fails with "missing required parameters" | Get subscription in Step 1 before any quota checks |
| **Using `learn=true` on MCP tools** | Extra round-trip to discover commands | Use exact command names documented above |
| **Searching documentation before checking subscription** | Generic info given instead of personalized availability | Check subscription quota first, use docs only for supplementary info |

## Common Issues & Quick Fixes

| Issue | Cause | Resolution |
|-------|-------|------------|
| "Model not found" error | Model not in region | Run discovery scripts, try different region |
| Deployment stuck "Creating" | Region at capacity | Wait or deploy to alternative region |
| Version unavailable | Staggered rollout | Use latest GA version, check preview regions |
| "SKU not available" error | SKU not in region | Check SKU availability via scripts |
| Free tier unavailable | F0 not in region | Use paid tier or different region |

## Diagnostic Checklist

- [ ] **FIRST:** Get subscription context via AskUserQuestion (Step 1)
- [ ] **For preview/limited models:** Check user's subscription quota FIRST (Step 2) — reveals if they already have access
- [ ] Verify model name and version are correct
- [ ] Quick catalog check: Use `foundry_models_list` MCP tool for single region (Step 3)
- [ ] Multi-region: Run `query_capacity` script to find all available regions (Step 4)
- [ ] Verify SKU type is supported (included in script output)
- [ ] Detailed quota analysis across regions if needed (Step 5)
- [ ] **Only if user lacks access:** Search documentation for access application info
- [ ] **Present personalized options to user via AskUserQuestion** (Step 6)

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

## Related Skills

- **[capacity](../models/deploy-model/capacity/SKILL.md)** — Full capacity discovery workflow and scripts
- **[preset](../models/deploy-model/preset/SKILL.md)** — Quick deployment after finding availability
- **[customize](../models/deploy-model/customize/SKILL.md)** — Custom deployment with full control
- **[quota](../quota/quota.md)** — Quota management and increase requests

## Additional Resources

- [Azure OpenAI Model Availability](https://learn.microsoft.com/azure/cognitive-services/openai/concepts/models)
- [Model Lifecycle and Deprecation](https://learn.microsoft.com/azure/cognitive-services/openai/concepts/model-retirements)
- [Azure OpenAI Service Quotas](https://learn.microsoft.com/azure/cognitive-services/openai/quotas-limits)
- **Detailed Flow:** See [references/model-availability-flow.md](references/model-availability-flow.md)
