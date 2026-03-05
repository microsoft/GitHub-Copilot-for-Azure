---
name: azure-quotas
description: >-
  Check and manage Azure service quotas (limits) and current usage across all Azure resource providers. Essential for deployment planning, region selection, and capacity validation. Supports compute, network, storage, ML, and all Azure services with quota API support.
  USE FOR: check quotas, view service limits, check current usage, request quota increase, quota exceeded error, validate deployment capacity, select region based on availability, provisioning limit check, check regional capacity, compare quotas across regions.
  DO NOT USE FOR: cost management (use azure-cost-optimization), resource deployment (use azure-deploy), general diagnostics (use azure-diagnostics), monitoring (use azure-observability).
---

# Azure Quotas - Service Limits & Capacity Management

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly for quota management and capacity validation.

## Overview

**What are Azure Quotas?**

Azure quotas (also called service limits) are the maximum number of resources you can deploy in a subscription. Quotas:
- Prevent accidental over-provisioning
- Ensure fair resource distribution across Azure
- Represent **available capacity** in each region
- Can be increased (adjustable quotas) or are fixed (non-adjustable)

**Key Concept:** **Quotas = Resource Availability**

If you don't have quota, you cannot deploy resources. Always check quotas when planning deployments or selecting regions.

## When to Use This Skill

Invoke this skill when:

- **Planning a new deployment** - Validate capacity before deployment
- **Selecting an Azure region** - Compare quota availability across regions (REQUIRED during azure-prepare)
- **Troubleshooting quota exceeded errors** - Check current usage vs limits
- **Requesting quota increases** - Submit increase requests via CLI or Portal
- **Comparing regional capacity** - Find regions with available quota
- **Validating provisioning limits** - Ensure deployment won't exceed quotas (invoked by azure-prepare)

> **CRITICAL: Integration with azure-prepare**
>
> This skill is **MANDATORY** during azure-prepare workflow when validating provisioning limits (Step 6). See [Integration with azure-prepare](#integration-with-azure-prepare) below.

## Quick Reference

| **Property** | **Details** |
|--------------|-------------|
| **Primary Tool** | Azure CLI (`az quota`) |
| **Extension Required** | `az extension add --name quota` (MUST install first) |
| **Key Commands** | `az quota list`, `az quota show`, `az quota usage list`, `az quota usage show` |
| **Complete CLI Reference** | [commands.md](./references/commands.md) |
| **Azure Portal** | [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) |
| **REST API** | Microsoft.Quota provider |
| **Required Permission** | Reader (view) or Quota Request Operator (manage) |

## Quota Types

| **Type** | **Adjustability** | **Approval** | **Examples** |
|----------|-------------------|--------------|--------------|
| **Adjustable** | Can increase via Portal/CLI/API | Usually auto-approved | VM vCPUs, Public IPs, Storage accounts |
| **Non-adjustable** | Fixed limits | Cannot be changed | Subscription-wide hard limits |

**Important:** Requesting quota increases is **free**. You only pay for resources you actually use, not for quota allocation.

## Understanding Resource Name Mapping

**⚠️ CRITICAL:** There is **NO 1:1 mapping** between ARM resource types and quota resource names.

### Example Mappings

| ARM Resource Type | Quota Resource Name |
|-------------------|---------------------|
| `Microsoft.App/managedEnvironments` | `ManagedEnvironmentCount` |
| `Microsoft.Compute/virtualMachines` | `standardDSv3Family`, `cores`, `virtualMachines` |
| `Microsoft.Network/publicIPAddresses` | `PublicIPAddresses`, `IPv4StandardSkuPublicIpAddresses` |

### Discovery Workflow

**Never assume the quota resource name from the ARM type.** Always use this workflow:

1. **List all quotas** for the resource provider:
   ```bash
   az quota list --scope /subscriptions/<id>/providers/<ProviderNamespace>/locations/<region>
   ```

2. **Match by `localizedValue`** (human-readable description) to find the relevant quota

3. **Use the `name` field** (not ARM resource type) in subsequent commands:
   ```bash
   az quota show --resource-name ManagedEnvironmentCount --scope ...
   az quota usage show --resource-name ManagedEnvironmentCount --scope ...
   ```

> **📖 Detailed mapping examples and workflow:** See [commands.md - Understanding Resource Name Mapping](./references/commands.md#understanding-resource-name-mapping)

## Core Workflows

### Workflow 1: Check Quota for a Specific Resource

**Scenario:** Verify quota limit and current usage before deployment

```bash
# 1. Install quota extension (if not already installed)
az extension add --name quota

# 2. List all quotas for the provider to find the quota resource name
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus

# 3. Show quota limit for a specific resource
az quota show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus

# 4. Show current usage
az quota usage show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus
```

**Example Output Analysis:**
- Quota limit: 350 vCPUs
- Current usage: 50 vCPUs
- Available capacity: 300 vCPUs (350 - 50)

> **📖 See also:** [az quota show](./references/commands.md#az-quota-show), [az quota usage show](./references/commands.md#az-quota-usage-show)

### Workflow 2: Compare Quotas Across Regions

**Scenario:** Find the best region for deployment based on available capacity

```bash
# Define candidate regions
REGIONS=("eastus" "eastus2" "westus2" "centralus")
VM_FAMILY="standardDSv3Family"
SUBSCRIPTION_ID="<subscription-id>"

# Check quota availability across regions
for region in "${REGIONS[@]}"; do
  echo "=== Checking $region ==="
  
  # Get limit
  LIMIT=$(az quota show \
    --resource-name $VM_FAMILY \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.limit.value" -o tsv)
  
  # Get current usage
  USAGE=$(az quota usage show \
    --resource-name $VM_FAMILY \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.usages.value" -o tsv)
  
  # Calculate available
  AVAILABLE=$((LIMIT - USAGE))
  
  echo "Region: $region | Limit: $LIMIT | Usage: $USAGE | Available: $AVAILABLE"
done
```

> **📖 See also:** [Multi-region comparison scripts](./references/commands.md#multi-region-comparison) (Bash & PowerShell)

### Workflow 3: Request Quota Increase

**Scenario:** Current quota is insufficient for deployment

```bash
# Request increase for VM quota
az quota update \
  --resource-name standardDSv3Family \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus \
  --limit-object value=500 \
  --resource-type dedicated

# Check request status
az quota request status list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus
```

**Approval Process:**
- Most adjustable quotas are auto-approved within minutes
- Some requests require manual review (hours to days)
- Non-adjustable quotas require Azure Support ticket

> **📖 See also:** [az quota update](./references/commands.md#az-quota-update), [az quota request status](./references/commands.md#az-quota-request-status-list)

### Workflow 4: List All Quotas for Planning

**Scenario:** Understand all quotas for a resource provider in a region

```bash
# List all compute quotas in East US (table format)
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus \
  --output table

# List all network quotas
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Network/locations/eastus \
  --output table

# List all Container Apps quotas
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.App/locations/eastus \
  --output table
```

> **📖 See also:** [az quota list](./references/commands.md#az-quota-list)

## Integration with azure-prepare

> **MANDATORY INTEGRATION:** This skill is invoked by **azure-prepare** during Step 6: Provisioning Limit Checklist.

### When Invoked

During the azure-prepare workflow, **after** the user selects subscription and region but **before** generating artifacts, you must:

1. **Prepare resource inventory** (azure-prepare Step 6 Phase 1)
   - List all resource types to be deployed
   - Specify deployment quantities

2. **Invoke azure-quotas skill** (azure-prepare Step 6 Phase 2)
   - Fetch quota limits and current usage for ALL planned resources
   - Validate sufficient capacity exists
   - Populate the Provisioning Limit Checklist table

### Provisioning Limit Check Workflow

**For each resource type in the deployment plan:**

```bash
# Step 1: Discover the quota resource name
az quota list \
  --scope /subscriptions/<subscription-id>/providers/<ProviderNamespace>/locations/<region>

# Step 2: Get current usage
az quota usage show \
  --resource-name <quota-resource-name> \
  --scope /subscriptions/<subscription-id>/providers/<ProviderNamespace>/locations/<region>

# Step 3: Get quota limit
az quota show \
  --resource-name <quota-resource-name> \
  --scope /subscriptions/<subscription-id>/providers/<ProviderNamespace>/locations/<region>

# Step 4: Calculate capacity
# Total After Deployment = Current Usage + Number to Deploy
# Available Capacity = Limit - Total After Deployment
```

### Example: Provisioning Limit Check

**Deployment Plan:**
- 3x Standard_D4s_v3 VMs (16 vCPUs each = 48 vCPUs total)
- 1x Container Apps managed environment
- 2x Public IP addresses

**Check quotas:**

```bash
SUBSCRIPTION_ID="4b0a7581-9eea-4d30-a166-f8fac23b6edd"
REGION="eastus"

# Check VM quota (standardDSv3Family)
echo "=== Checking Compute vCPUs ==="
az quota usage show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$REGION \
  --query "{Current:properties.usages.value}" -o table

az quota show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$REGION \
  --query "{Limit:properties.limit.value}" -o table

# Current: 50 vCPUs
# Limit: 350 vCPUs
# Need: 48 vCPUs
# Total after deployment: 98 vCPUs (50 + 48)
# Available: 252 vCPUs (350 - 98)
# ✅ SUFFICIENT CAPACITY

# Check Container Apps quota
echo "=== Checking Container Apps ==="
az quota usage show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.App/locations/$REGION \
  --query "{Current:properties.usages.value}" -o table

az quota show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.App/locations/$REGION \
  --query "{Limit:properties.limit.value}" -o table

# Current: 0
# Limit: 50
# Need: 1
# Total after deployment: 1
# Available: 49
# ✅ SUFFICIENT CAPACITY

# Check Public IP quota
echo "=== Checking Public IPs ==="
az quota usage show \
  --resource-name PublicIPAddresses \
  --scope /subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Network/locations/$REGION \
  --query "{Current:properties.usages.value}" -o table

az quota show \
  --resource-name PublicIPAddresses \
  --scope /subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Network/locations/$REGION \
  --query "{Limit:properties.limit.value}" -o table

# Current: 5
# Limit: 100
# Need: 2
# Total after deployment: 7
# Available: 93
# ✅ SUFFICIENT CAPACITY
```

### Populating the Checklist Table

After running quota checks, populate the azure-prepare plan table:

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.Compute/virtualMachines (Standard_D4s_v3) | 3 (48 vCPUs) | 98 vCPUs | 350 vCPUs | Fetched from: azure-quotas (standardDSv3Family) |
| Microsoft.App/managedEnvironments | 1 | 1 | 50 | Fetched from: azure-quotas (ManagedEnvironmentCount) |
| Microsoft.Network/publicIPAddresses | 2 | 7 | 100 | Fetched from: azure-quotas (PublicIPAddresses) |

**Status:** ✅ All resources within limits

### Handling Unsupported Providers

If `az quota list` returns a `BadRequest` error, the provider doesn't support the quota API:

```bash
# Example: Microsoft.DocumentDB (Cosmos DB) - not supported
az quota list \
  --scope /subscriptions/<id>/providers/Microsoft.DocumentDB/locations/eastus

# Error: (BadRequest) Bad request
```

**Fallback:** Reference [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) and document in the Notes column:

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.DocumentDB/databaseAccounts | 1 | 1 | 50 per region | Fetched from: Official docs (quota API not supported) |

> **📖 See also:** [Troubleshooting - Unsupported Resource Types](./references/commands.md#unsupported-resource-types)

### Critical Rules for azure-prepare Integration

1. **MUST complete Phase 2** - No "_TBD_" entries allowed in the provisioning checklist before presenting plan to customer
2. **MUST use actual commands** - Run `az quota list`, `az quota usage show`, `az quota show` for each resource type
3. **MUST calculate totals** - Show current + planned = total after deployment
4. **MUST validate capacity** - Ensure total ≤ limit for all resources
5. **MUST document source** - Note whether from "azure-quotas (resource-name)" or "Official docs"

If any resource exceeds quota, **STOP** and either:
- Return to region selection (Step 4 of azure-prepare)
- Request quota increase (use Workflow 3 above)
- Adjust deployment plan to use fewer resources

## Troubleshooting

### Common Errors

| **Error** | **Cause** | **Solution** |
|-----------|-----------|--------------|
| `ExtensionNotFound` | Quota extension not installed | `az extension add --name quota` |
| `BadRequest` | Resource provider not supported by quota API | Use Azure Portal or [service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| `MissingRegistration` | Microsoft.Quota provider not registered | `az provider register --namespace Microsoft.Quota` |
| `QuotaExceeded` | Deployment would exceed quota | Request increase or choose different region |
| `InvalidScope` | Incorrect scope format | Use pattern: `/subscriptions/<id>/providers/<namespace>/locations/<region>` |

### Unsupported Resource Providers

**Known unsupported providers:**
- ❌ Microsoft.DocumentDB (Cosmos DB) - Use Portal or [Cosmos DB limits docs](https://learn.microsoft.com/en-us/azure/cosmos-db/concepts-limits)

**Confirmed working providers:**
- ✅ Microsoft.Compute (VMs, disks, cores)
- ✅ Microsoft.Network (VNets, IPs, load balancers)
- ✅ Microsoft.App (Container Apps)
- ✅ Microsoft.Storage (storage accounts)
- ✅ Microsoft.MachineLearningServices (ML compute)

> **📖 See also:** [Troubleshooting Guide](./references/commands.md#troubleshooting)

## Additional Resources

| Resource | Link |
|----------|------|
| **CLI Commands Reference** | [commands.md](./references/commands.md) - Complete syntax, parameters, examples |
| **Azure Quotas Overview** | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview) |
| **Service Limits Documentation** | [Azure subscription limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| **Azure Portal - My Quotas** | [Portal Link](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) |
| **Request Quota Increases** | [How to request increases](https://learn.microsoft.com/en-us/azure/quotas/quickstart-increase-quota-portal) |

## Best Practices

1. ✅ **Always check quotas before deployment** - Prevent quota exceeded errors
2. ✅ **Run `az quota list` first** - Discover correct quota resource names
3. ✅ **Compare regions** - Find regions with available capacity
4. ✅ **Account for growth** - Request 20% buffer above immediate needs
5. ✅ **Use table output for overview** - `--output table` for quick scanning
6. ✅ **Document quota sources** - Track whether from quota API or official docs
7. ✅ **Monitor usage trends** - Set up alerts at 80% threshold (via Portal)

## Workflow Summary

```
┌─────────────────────────────────────────┐
│  1. Install quota extension             │
│     az extension add --name quota       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  2. Discover quota resource names       │
│     az quota list --scope ...           │
│     (Match by localizedValue)           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  3. Check current usage                 │
│     az quota usage show                 │
│     --resource-name <name>              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  4. Check quota limit                   │
│     az quota show                       │
│     --resource-name <name>              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  5. Validate capacity                   │
│     Available = Limit - (Usage + Need)  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────┴────────┐
         │                 │
    ✅ Sufficient     ❌ Insufficient
         │                 │
         ▼                 ▼
    Proceed          Request increase
                     or change region
```
