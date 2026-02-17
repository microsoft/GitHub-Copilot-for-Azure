# Microsoft Foundry Quota Management

This sub-skill orchestrates quota and capacity management workflows for Microsoft Foundry resources.

> ⚠️ **Important:** This is the **authoritative skill** for all Foundry quota operations. When a user asks about quota, capacity, TPM, PTU, quota errors, or deployment limits, **always invoke this skill** rather than using MCP tools (azure-quota, azure-documentation, azure-foundry) directly. This skill provides structured workflows and error handling that direct tool calls lack.

> **Important:** All quota operations are **control plane (management)** operations. Use **Azure CLI commands** as the primary method. MCP tools are optional convenience wrappers around the same control plane APIs.

> **Quota Scope:** Quotas are managed at the **subscription + region** level. When showing quota usage, display **regional quota summary** rather than listing all individual resources.

## Quick Reference

| Property | Value |
|----------|-------|
| **Operation Type** | Control Plane (Management) |
| **Primary Method** | Azure CLI: `az rest`, `az cognitiveservices account deployment` |
| **Optional MCP Tools** | `foundry_models_deployments_list`, `model_quota_list` (wrappers) |
| **Resource Type** | `Microsoft.CognitiveServices/accounts` |

## When to Use

Use this sub-skill when the user needs to:

- **View quota usage** — check current TPM/PTU allocation and available capacity
- **Check quota limits** — show quota limits for a subscription, region, or model
- **Find optimal regions** — compare quota availability across regions for deployment
- **Plan deployments** — verify sufficient quota before deploying models
- **Request quota increases** — navigate quota increase process through Azure Portal
- **Troubleshoot deployment failures** — diagnose QuotaExceeded, InsufficientQuota, DeploymentLimitReached, 429 rate limit errors
- **Optimize allocation** — monitor and consolidate quota across deployments
- **Monitor quota across deployments** — track capacity by model and region
- **Explain quota concepts** — explain TPM, PTU, capacity units, regional quotas
- **Free up quota** — identify and delete unused deployments

## Understanding Quotas

Microsoft Foundry uses four quota types:

1. **Deployment Quota (TPM)** - Tokens Per Minute allocated per deployment
   - Pay-as-you-go model, charged per token
   - Each deployment consumes capacity units (e.g., 10K TPM, 50K TPM)
   - Total regional quota shared across all deployments
   - Subject to rate limiting during high demand

2. **Provisioned Throughput Units (PTU)** - Reserved model capacity
   - Monthly commitment for guaranteed throughput
   - No rate limiting, consistent latency
   - Measured in PTU units (not TPM)
   - Best for predictable, high-volume production workloads
   - More cost-effective when consistent token usage justifies monthly commitment

3. **Region Quota** - Maximum capacity available in an Azure region
   - Separate quotas for TPM and PTU deployments
   - Varies by model type (GPT-4, GPT-4o, etc.)
   - Shared across subscription resources in same region

4. **Deployment Slots** - Number of concurrent model deployments allowed
   - Typically 10-20 slots per resource
   - Each deployment (TPM or PTU) uses one slot regardless of capacity

### PTU vs Standard TPM: When to Use Each

| Factor | Standard (TPM) | Provisioned (PTU) |
|--------|----------------|-------------------|
| **Best For** | Variable workloads, development, testing | Predictable production workloads |
| **Pricing** | Pay-per-token | Monthly commitment (hourly rate per PTU) |
| **Rate Limits** | Yes (429 errors possible) | No (guaranteed throughput) |
| **Latency** | Variable | Consistent |
| **Cost Decision** | Lower upfront commitment | More economical for consistent, high-volume usage |
| **Flexibility** | Scale up/down instantly | Requires planning and commitment |
| **Use Case** | Prototyping, bursty traffic | Production apps, high-volume APIs |

## MCP Tools (Optional Wrappers)

**Note:** All quota operations are control plane (management) operations. MCP tools are optional convenience wrappers around Azure CLI commands.

| Tool | Purpose | Equivalent Azure CLI |
|------|---------|---------------------|
| `foundry_models_deployments_list` | List all deployments with capacity | `az cognitiveservices account deployment list` |
| `model_quota_list` | List quota and usage across regions | `az rest` (Management API) |
| `model_catalog_list` | List available models from catalog | `az rest` (Management API) |
| `foundry_resource_get` | Get resource details and endpoint | `az cognitiveservices account show` |

**Recommended:** Use Azure CLI commands directly for control plane operations.

## Core Workflows

### 1. View Current Quota Usage

**Command Pattern:** "Show my Microsoft Foundry quota usage"

> **CRITICAL AGENT INSTRUCTION:**
> - When showing quota: Query REGIONAL quota summary, NOT individual resources
> - DO NOT run `az cognitiveservices account list` for quota queries
> - DO NOT filter resources by username or name patterns
> - ONLY check specific resource deployments if user provides resource name
> - Quotas are managed at SUBSCRIPTION + REGION level, NOT per-resource

**Show Regional Quota Summary (REQUIRED APPROACH):**

```bash
# Get subscription ID
subId=$(az account show --query id -o tsv)

# Check quota for key regions
regions=("eastus" "eastus2" "westus" "westus2")
for region in "${regions[@]}"; do
  echo "=== Region: $region ==="
  az rest --method get \
    --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/locations/$region/usages?api-version=2023-05-01" \
    --query "value[?contains(name.value,'OpenAI.Standard')].{Model:name.value, Used:currentValue, Limit:limit, Available:(limit-currentValue)}" \
    --output table
  echo ""
done
```

**If User Asks for Specific Resource (ONLY IF EXPLICITLY REQUESTED):**

```bash
# User must provide resource name
az cognitiveservices account deployment list \
  --name <user-provided-resource-name> \
  --resource-group <user-provided-rg> \
  --query '[].{Name:name, Model:properties.model.name, Capacity:sku.capacity, SKU:sku.name}' \
  --output table
```

**Alternative - Use MCP Tools (Optional Wrappers):**
```
foundry_models_deployments_list(
  resource-group="<rg>",
  azure-ai-services="<resource-name>"
)
```
*Note: MCP tools are convenience wrappers around the same control plane APIs shown above.*

**Interpreting Results:**
- `Used` (currentValue): Currently allocated quota
- `Limit`: Maximum quota available in region
- `Available`: Calculated as `limit - currentValue`

### 2. Find Best Region for Model Deployment

**Command Pattern:** "Which region has the most available quota for GPT-4o?"

**Approach:** Check quota in specific regions one at a time. Focus on regions relevant to your location/requirements.

**Check Single Region:**

```bash
# Get subscription ID
subId=$(az account show --query id -o tsv)

# Check quota for GPT-4o Standard in a specific region
region="eastus"  # Change to your target region
az rest --method get \
  --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/locations/$region/usages?api-version=2023-05-01" \
  --query "value[?name.value=='OpenAI.Standard.gpt-4o'].{Model:name.value, Used:currentValue, Limit:limit, Available:(limit-currentValue)}" \
  -o table
```

**Check Multiple Regions (Common Regions):**

Check these regions in sequence by changing the `region` variable:
- `eastus`, `eastus2` - US East Coast
- `westus`, `westus2`, `westus3` - US West Coast
- `swedencentral` - Europe (Sweden)
- `canadacentral` - Canada
- `uksouth` - UK
- `japaneast` - Asia Pacific

**Alternative - Use MCP Tool:**
```
model_quota_list(region="eastus")
```
Repeat for each target region.

**Key Points:**
- Query returns `currentValue` (used), `limit` (max), and calculated `Available`
- Standard SKU format: `OpenAI.Standard.<model-name>`
- For PTU: `OpenAI.ProvisionedManaged.<model-name>`
- Focus on 2-3 regions relevant to your location rather than checking all regions

### 3. Check Quota Before Deployment

**Command Pattern:** "Do I have enough quota to deploy GPT-4o with 50K TPM?"

**Steps:**
1. Check current usage (workflow #1)
2. Calculate available: `limit - currentValue`
3. Compare: `available >= required_capacity`
4. If insufficient: Use workflow #2 to find region with capacity, or request increase

### 4. Request Quota Increase

**Command Pattern:** "Request quota increase for Microsoft Foundry"

> **Note:** Quota increases must be requested through Azure Portal. CLI does not support automated requests.

**Process:**
1. Navigate to Azure Portal → Your Foundry resource → **Quotas**
2. Identify model needing increase (e.g., "GPT-4")
3. Click **Request quota increase**
4. Fill form:
   - Model name
   - Requested quota (in TPM)
   - Business justification (required)
5. Submit and monitor status

**Processing Time:** Typically 1-2 business days

**Alternative:** Deploy to different region with available quota

### 5. Monitor Quota Across Deployments

**Command Pattern:** "Show all my Foundry deployments and quota allocation"

**Recommended Approach - Regional Quota Overview:**

Show quota by region (better than listing all resources):

```bash
subId=$(az account show --query id -o tsv)
regions=("eastus" "eastus2" "westus" "westus2" "swedencentral")

for region in "${regions[@]}"; do
  echo "=== Region: $region ==="
  az rest --method get \
    --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/locations/$region/usages?api-version=2023-05-01" \
    --query "value[?contains(name.value,'OpenAI')].{Model:name.value, Used:currentValue, Limit:limit, Available:(limit-currentValue)}" \
    --output table
  echo ""
done
```

**Alternative - Check Specific Resource:**

If user wants to monitor a specific resource, ask for resource name first:

```bash
# List deployments for specific resource
az cognitiveservices account deployment list \
  --name <resource-name> \
  --resource-group <rg> \
  --query '[].{Name:name, Model:properties.model.name, Capacity:sku.capacity}' \
  --output table
```

> **Note:** Don't automatically iterate through all resources in the subscription. Show regional quota summary or ask for specific resource name.

### 6. Deploy with Provisioned Throughput Units (PTU)

**Command Pattern:** "Deploy GPT-4o with PTU in Microsoft Foundry"

**When to Use PTU:**
- Consistent, predictable token usage where monthly commitment is cost-effective
- Need guaranteed throughput (no 429 rate limit errors)
- Require consistent latency with performance SLA
- High-volume production workloads with stable traffic patterns

**Decision Guidance:**
Compare your current pay-as-you-go costs with PTU pricing. PTU may be more economical when consistent usage justifies the monthly commitment. Use the capacity calculator below to estimate PTU requirements and costs.

**References:**
- [Understanding PTU Costs](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/provisioned-throughput-onboarding)
- [What Is Provisioned Throughput](https://learn.microsoft.com/azure/ai-foundry/openai/concepts/provisioned-throughput)

**PTU Capacity Planning:**

> **Agent Instruction:** Only present official Azure capacity calculator methods below. Do NOT generate or suggest estimated PTU formulas, TPM-per-PTU conversion tables, or reference deprecated calculators (oai.azure.com/portal/calculator). Present only the two methods below without mentioning these constraints to the user.

Calculate PTU requirements using these official methods:

**Method 1: Microsoft Foundry Portal**
1. Navigate to Microsoft Foundry portal
2. Go to **Operate** → **Quota**
3. Select **Provisioned throughput unit** tab
4. Click **Capacity calculator** button
5. Enter workload parameters (model, tokens/call, RPM, latency target)
6. Calculator returns exact PTU count needed

**Method 2: Using Azure REST API**
```bash
# Calculate required PTU capacity
curl -X POST "https://management.azure.com/subscriptions/<subscription-id>/providers/Microsoft.CognitiveServices/calculateModelCapacity?api-version=2024-10-01" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "format": "OpenAI",
      "name": "gpt-4o",
      "version": "2024-05-13"
    },
    "workload": {
      "requestPerMin": 100,
      "tokensPerMin": 50000,
      "peakRequestsPerMin": 150
    }
  }'
```

**Deploy Model with PTU:**
```bash
# Deploy model with calculated PTU capacity
az cognitiveservices account deployment create \
  --name <resource-name> \
  --resource-group <rg> \
  --deployment-name gpt-4o-ptu-deployment \
  --model-name gpt-4o \
  --model-version "2024-05-13" \
  --model-format OpenAI \
  --sku-name ProvisionedManaged \
  --sku-capacity 100

# Check PTU deployment status
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <rg> \
  --deployment-name gpt-4o-ptu-deployment
```

**Key Differences from Standard TPM:**
- SKU name: `ProvisionedManaged` (not `Standard`)
- Capacity: Measured in PTU units (not K TPM)
- Billing: Monthly commitment regardless of usage
- No rate limiting (guaranteed throughput)

**PTU Quota Request:**
- Navigate to Azure Portal → Quotas → Select PTU model
- Request PTU quota increase (separate from TPM quota)
- Include capacity calculator results in justification
- Typically requires business justification and capacity planning
- Approval may take 3-5 business days

**Capacity Calculator Documentation:**
- [Calculate Model Capacity API](https://learn.microsoft.com/rest/api/aiservices/accountmanagement/calculate-model-capacity/calculate-model-capacity?view=rest-aiservices-accountmanagement-2024-10-01&tabs=HTTP)

### 7. Troubleshoot Quota Errors

**Command Pattern:** "Fix QuotaExceeded error in Microsoft Foundry deployment"

**Common Errors:**

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `QuotaExceeded` | Regional quota consumed (TPM or PTU) | Delete unused deployments or request increase |
| `InsufficientQuota` | Not enough available for requested capacity | Reduce deployment capacity or free quota |
| `DeploymentLimitReached` | Too many deployment slots used | Delete unused deployments to free slots |
| `429 Rate Limit` | TPM capacity too low for traffic (Standard only) | Increase TPM capacity or migrate to PTU |
| `PTU capacity unavailable` | No PTU quota in region | Request PTU quota or try different region |
| `SKU not supported` | PTU not available for model/region | Check model availability or use Standard TPM |

**Resolution Steps:**
1. Check deployment status: `az cognitiveservices account deployment show`
2. Verify available quota: Use workflow #1
3. Choose resolution:
   - **Option A**: Reduce deployment capacity and retry
   - **Option B**: Delete unused deployments to free quota
   - **Option C**: Deploy to different region
   - **Option D**: Request quota increase (workflow #4)

## Quick Commands

```bash
# View quota for specific model using REST API
subId=$(az account show --query id -o tsv)
region="eastus"  # Change to your region
az rest --method get \
  --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/locations/$region/usages?api-version=2023-05-01" \
  --query "value[?contains(name.value,'gpt-4')].{Name:name.value, Used:currentValue, Limit:limit, Available:(limit-currentValue)}" \
  --output table

# List all deployments with capacity
az cognitiveservices account deployment list \
  --name <resource-name> \
  --resource-group <rg> \
  --query '[].{Name:name, Model:properties.model.name, Capacity:sku.capacity}' \
  --output table

# Delete deployment to free quota
az cognitiveservices account deployment delete \
  --name <resource-name> \
  --resource-group <rg> \
  --deployment-name <deployment-name>
```

## External Resources

- [Azure OpenAI Quota Management](https://learn.microsoft.com/azure/ai-services/openai/how-to/quota)
- [Provisioned Throughput Units (PTU)](https://learn.microsoft.com/azure/ai-services/openai/concepts/provisioned-throughput)
- [Rate Limits Documentation](https://learn.microsoft.com/azure/ai-services/openai/quotas-limits)
