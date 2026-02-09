# Microsoft Foundry Quota Management

This sub-skill orchestrates quota and capacity management workflows for Microsoft Foundry resources.

## Quick Reference

| Property | Value |
|----------|-------|
| **MCP Tools** | `foundry_models_deployments_list`, `model_quota_list`, `model_catalog_list` |
| **CLI Commands** | `az rest` (Management API), `az cognitiveservices account deployment` |
| **Resource Type** | `Microsoft.CognitiveServices/accounts` |

## When to Use

Use this sub-skill when you need to:

- **View quota usage** - Check current TPM allocation and available capacity
- **Find optimal regions** - Compare quota availability across regions for deployment
- **Plan deployments** - Verify sufficient quota before deploying models
- **Request increases** - Navigate quota increase process through Azure Portal
- **Troubleshoot failures** - Diagnose QuotaExceeded, InsufficientQuota, DeploymentLimitReached errors
- **Optimize allocation** - Monitor and consolidate quota across deployments

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

## MCP Tools Used

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `foundry_models_deployments_list` | List all deployments with capacity | Check current quota allocation for a resource |
| `model_quota_list` | List quota and usage across regions | Find regions with available capacity |
| `model_catalog_list` | List available models from catalog | Check model availability by region |
| `foundry_resource_get` | Get resource details and endpoint | Verify resource configuration |

## Core Workflows

### 1. View Current Quota Usage

**Command Pattern:** "Show my Microsoft Foundry quota usage"

**Recommended Approach - Use MCP Tools:**
```
foundry_models_deployments_list(
  resource-group="<rg>",
  azure-ai-services="<resource-name>"
)
```
Returns: Deployment names, models, SKU capacity (TPM), provisioning state

**Alternative - Use Azure CLI:**
```bash
# List all deployments with capacity
az cognitiveservices account deployment list \
  --name <resource-name> \
  --resource-group <rg> \
  --query '[].{Name:name, Model:properties.model.name, Capacity:sku.capacity, SKU:sku.name}' \
  --output table

# Get regional quota via REST API (more reliable)
subId=$(az account show --query id -o tsv)
az rest --method get \
  --url "https://management.azure.com/subscriptions/$subId/providers/Microsoft.CognitiveServices/locations/eastus/usages?api-version=2023-05-01" \
  --query "value[?contains(name.value,'OpenAI')].{Name:name.value, Used:currentValue, Limit:limit, Available:(limit-currentValue)}" \
  --output table
```

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

**For Single Resource:**
Use workflow #1 above

**For Multiple Resources:**
```bash
# List all Foundry resources
az cognitiveservices account list \
  --query '[?kind==`AIServices`]' \
  --output table

# For each resource, check deployments
for resource in $(az cognitiveservices account list --query '[?kind==`AIServices`].name' -o tsv); do
    echo "=== $resource ==="
    az cognitiveservices account deployment list --name "$resource" --output table
done
```

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

> **Agent Instruction:** Only present official Azure capacity calculator methods below. Do NOT generate or suggest estimated PTU formulas, TPM-per-PTU conversion tables, or reference deprecated calculators (oai.azure.com/portal/calculator). Present only the three methods below without mentioning these constraints to the user.

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

**Method 3: Using Azure CLI (if available)**
```bash
az cognitiveservices account calculate-model-capacity \
  --model-format OpenAI \
  --model-name gpt-4o \
  --model-version "2024-05-13" \
  --workload-requests-per-min 100 \
  --workload-tokens-per-min 50000
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
