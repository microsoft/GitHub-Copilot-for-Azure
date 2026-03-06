# Azure Resource Limits and Quotas

Reference guide for checking Azure resource availability through hard limits and quotas during azure-prepare workflow.

## Overview

Before deploying Azure resources, validate that your planned deployment won't exceed:
1. **Hard Limits** - Fixed service constraints that cannot be changed
2. **Quotas** - Subscription limits that can be requested to increase

> **CRITICAL: Check After Customer Selects Region**
>
> Always check limits and quotas AFTER the customer selects their preferred region. This ensures you can validate availability and request quota increases if needed before deployment.

> **⚠️ IMPORTANT: Use Azure CLI for Quota Checks**
>
> **Always use Azure CLI (`az quota`) as the primary method** for checking quotas. The CLI provides:
> - Better error handling for unsupported providers
> - Clearer quota resource name discovery
> - Consistent output format
>
> If you see **"No Limit"** or unlimited values in REST API or Portal responses, this does **NOT** mean unlimited capacity. It may indicate that the quota doesn't exist for that resource type or is not enforced via the quota API. Always cross-reference with official service documentation.

## Two Types of Availability Checks

### 1. Hard Limits

**Definition**: Fixed service constraints set by Azure that cannot be changed regardless of support requests.

**Source**: Azure documentation via `azure__documentation` tool

**Examples**:
- Max item size in Cosmos DB: 2 MB (hard limit)
- Max partition key value size: 2 KB (hard limit)
- HTTP request timeout in Container Apps: 240 seconds (hard limit)
- Deployment slots in App Service Free tier: 0 (hard limit)

**Check Process**:
1. Identify Azure services needed for the deployment
2. Determine the number and size of resources to be created
3. Look up hard limits in azure-provisioning-limit skill or via `azure__documentation`
4. Compare planned resources against hard limits
5. If limits would be exceeded, redesign architecture or choose different service tier

**Example Workflow**:
```
Plan: Deploy 1000 items to Cosmos DB, each item is 3 MB
Hard Limit: Max item size = 2 MB
Result: ❌ Exceeds limit - redesign to split items or use blob storage for large data
```

### 2. Quotas

**Definition**: Subscription-level or regional limits that can be increased by submitting a support request.

**Source**: Azure Quota Management API via Azure CLI (`az quota` extension)

> **⚠️ IMPORTANT: Always Use CLI First**
>
> **Prefer Azure CLI** (`az quota`) over REST API for quota checks. The CLI provides better error handling and clearer results.
>
> If using REST API or Portal and you see **"No Limit"** or unlimited values, this does **NOT** necessarily mean unlimited capacity. It may indicate:
> - The resource provider does not enforce quotas for that resource type
> - The quota information is not available through the API
> - The quota is managed at a different scope (e.g., service-level rather than subscription-level)
>
> Always cross-reference with [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) and consider service-specific limits when planning deployments.

**Examples**:
- AKS clusters per region: 5,000 (can request increase)
- Storage accounts per region: 250 (can request increase)
- Container Apps environments per region: 50 (can request increase)
- VM vCPUs per family: Varies by SKU (can request increase)

> **⚠️ CRITICAL CONCEPT: No 1:1 Resource Name Mapping**
>
> There is **NO 1:1 mapping** between ARM resource types and quota resource names. You **cannot** guess the quota resource name from the ARM resource type.
>
> **Examples:**
> - ARM Type: `Microsoft.App/managedEnvironments` → Quota Name: `ManagedEnvironmentCount`
> - ARM Type: `Microsoft.Compute/virtualMachines` → Quota Names: `standardDSv3Family`, `cores`, `virtualMachines`
> - ARM Type: `Microsoft.Network/publicIPAddresses` → Quota Names: `PublicIPAddresses`, `IPv4StandardSkuPublicIpAddresses`
>
> **Always use the discovery workflow below to find the correct quota resource name.**

**Check Process**:
1. **Install quota extension** (if not already installed):
   ```bash
   az extension add --name quota
   ```

2. **Discover quota resource names** - List all quotas for the provider:
   ```bash
   az quota list --scope /subscriptions/<id>/providers/<ProviderNamespace>/locations/<region>
   ```

3. **Match by `localizedValue`** - Look for the human-readable description that matches your resource type

4. **Check current usage** - Use the discovered quota resource name:
   ```bash
   az quota usage show \
     --resource-name <quota-resource-name> \
     --scope /subscriptions/<id>/providers/<ProviderNamespace>/locations/<region>
   ```

5. **Check quota limit**:
   ```bash
   az quota show \
     --resource-name <quota-resource-name> \
     --scope /subscriptions/<id>/providers/<ProviderNamespace>/locations/<region>
   ```

6. **Calculate**: `Available Capacity = Quota Limit - Current Usage`

7. **Compare** planned resources against available capacity

8. **If quota would be exceeded**, request quota increase via `az quota update`

**Example Workflow**:
```bash
# Plan: Deploy 1 Container Apps managed environment in eastus

# Step 1: Discover quota resource name
az quota list \
  --scope /subscriptions/<id>/providers/Microsoft.App/locations/eastus

# Output shows: "ManagedEnvironmentCount" (not "managedEnvironments")

# Step 2: Check current usage
az quota usage show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/<id>/providers/Microsoft.App/locations/eastus
# Result: Current usage = 8

# Step 3: Check quota limit
az quota show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/<id>/providers/Microsoft.App/locations/eastus
# Result: Limit = 50

# Step 4: Calculate
# Available Capacity: 50 - 8 = 42 environments
# Need: 1 environment
# Result: ✅ Sufficient capacity
```

**Unsupported Providers**:

Not all Azure resource providers support the quota API. If `az quota list` returns a `BadRequest` error, the provider doesn't support quota commands:

```bash
# Example: Microsoft.DocumentDB (Cosmos DB) - NOT SUPPORTED
az quota list \
  --scope /subscriptions/<id>/providers/Microsoft.DocumentDB/locations/eastus

# Error: (BadRequest) Bad request
# Code: BadRequest
# Message: Bad request
```

**Fallback for unsupported providers:**

> **⚠️ IMPORTANT:** Use these fallback methods **ONLY** when quota API returns `BadRequest` error. Always try quota API first.

1. **Test if quota API is supported:**
   ```bash
   az quota list --scope /subscriptions/{sub-id}/providers/{Provider}/locations/{region}
   ```

2. **ONLY if BadRequest error, get current usage using:**
   
   **Option A - Azure Resource Graph (Recommended for counting):**
   ```bash
   # Install resource-graph extension first (if not already installed)
   az extension add --name resource-graph
   
   # Query resource count
   az graph query -q "resources | where type == '{resource-type}' and location == '{location}' | count"
   ```
   
   Example for Cosmos DB in eastus:
   ```bash
   az graph query -q "resources | where type == 'microsoft.documentdb/databaseaccounts' and location == 'eastus' | count"
   ```
   
   **Option B - Azure CLI Resource List (For detailed resource info):**
   ```bash
   az resource list --subscription "{subscription-id}" --resource-type "{Resource.Type}" --location "{location}"
   ```
   
   Example for Cosmos DB:
   ```bash
   az resource list --subscription "4b0a7581-9eea-4d30-a166-f8fac23b6edd" \
     --resource-type "Microsoft.DocumentDB/databaseAccounts" \
     --location "eastus"
   ```
   Then count the results manually or use: `| jq 'length'`

3. **Get limit value from documentation:**
   - **Generic limits:** [Azure subscription service limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
   - **Service-specific docs:** e.g., [Cosmos DB limits](https://learn.microsoft.com/en-us/azure/cosmos-db/concepts-limits)

4. **Calculate availability:**
   ```
   Available Capacity = Documented Limit - Current Usage (from Resource Graph or CLI)
   ```

5. **Document in provisioning checklist:**
   - Current usage: From `az graph query` or `az resource list`
   - Limit: From official documentation
   - Source: "Fetched from: Azure Resource Graph + Official docs" or "az resource list + Official docs"

> **⚠️ WARNING: Interpreting "No Limit" Results**
>
> If REST API or Portal shows **"No Limit"**, **"Unlimited"**, or similar values, do NOT assume unlimited capacity:
> - The quota may not be enforced via the quota API
> - Service-specific limits may still apply (check service documentation)
> - Regional capacity constraints may exist even without quota enforcement
> - The resource may be limited by other factors (cost, availability, etc.)
>
> **Always verify** with official service documentation before assuming unlimited capacity.

**Known unsupported providers:**
- ❌ Microsoft.DocumentDB (Cosmos DB)

**Confirmed working providers:**
- ✅ Microsoft.Compute (VMs, disks, cores)
- ✅ Microsoft.Network (VNets, IPs, load balancers)
- ✅ Microsoft.App (Container Apps)
- ✅ Microsoft.Storage (storage accounts)
- ✅ Microsoft.MachineLearningServices

## Check Period Workflow

During the azure-prepare workflow, follow this sequence:

### Phase 1: Identify Requirements

```
1. Analyze application requirements
2. Select Azure services (AKS, Cosmos DB, Storage, etc.)
3. Determine resource counts:
   - How many VMs, containers, databases?
   - What sizes/tiers are needed?
   - What throughput requirements?
```

### Phase 2: Check Hard Limits

```
1. Load azure-provisioning-limit skill for quick reference
2. For each service, check hard limits:
   
   Example - Cosmos DB:
   - Item size: Max 2 MB ✓
   - Partition key value: Max 2 KB ✓
   - Container storage (Serverless): Max 50 GB ✓
   
3. Validate planned resources against hard limits
4. If any hard limit would be exceeded:
   - Redesign architecture
   - Choose different tier
   - Split resources across multiple accounts
```

### Phase 3: Check Quotas

```
1. Invoke azure-quotas skill or use CLI directly
2. For each service and region, check quota availability:

   Example - Check Storage Accounts in eastus:
   
   az quota usage list \
     --scope /subscriptions/{subscription-id}/providers/Microsoft.Storage/locations/eastus \
     --resource-name StorageAccounts
   
   Response:
   {
     "limit": 250,
     "currentValue": 180,
     "name": "StorageAccounts"
   }
   
   Available: 250 - 180 = 70 accounts ✓
   
3. Calculate if planned resources fit within available quota
4. If quota would be exceeded:
   - Request quota increase (use azure-quotas skill)
   - Choose region with more available quota
   - Split deployment across multiple regions
```

### Phase 4: Validate Selected Region

```
1. Get customer's region preference first
2. Check quota availability in the selected region:

   Example - Customer selects East US:
   
   az quota usage list \
     --scope /subscriptions/{sub-id}/providers/Microsoft.Storage/locations/eastus \
     --resource-name StorageAccounts
   
   Result: 70 storage accounts available ✓
   
   az quota usage list \
     --scope /subscriptions/{sub-id}/providers/Microsoft.DocumentDB/locations/eastus
   
   Result: 2 Cosmos DB accounts available ✓

3. If quota is insufficient:
   - Request quota increase using azure-quotas skill
   - Suggest alternative region if increase not possible
   - Wait for approval before proceeding
```

## Common Limit Scopes

Understanding where limits apply:

| **Scope** | **Description** | **Example** |
|-----------|-----------------|-------------|
| **Subscription** | Total across all regions | 50 Cosmos DB accounts per subscription (any region) |
| **Regional** | Per region within subscription | 250 storage accounts per region |
| **Account/Resource** | Per individual resource | 500 apps per Container Apps environment |

## Service-Specific Checking Patterns

### Cosmos DB

**Hard Limits to Check**:
- Item size: 2 MB
- Partition key value size: 2 KB
- Max storage (Serverless): 50 GB

**Quotas to Check**:

⚠️ **Microsoft.DocumentDB does NOT support quota API**. You will receive a `BadRequest` error if you try to use `az quota list`.

```bash
# This will FAIL with BadRequest error:
az quota list \
  --scope /subscriptions/{sub-id}/providers/Microsoft.DocumentDB/locations/{region}

# Error: (BadRequest) Bad request
```

**Fallback approach:**

1. **Get current usage using Azure Resource Graph:**
   ```bash
   # Install resource-graph extension (if not already installed)
   az extension add --name resource-graph
   
   # Query Cosmos DB account count
   az graph query -q "resources | where type == 'microsoft.documentdb/databaseaccounts' and location == 'eastus' | count"
   ```
   
   Or using Azure CLI resource list:
   ```bash
   az resource list \
     --subscription "{subscription-id}" \
     --resource-type "Microsoft.DocumentDB/databaseAccounts" \
     --location "eastus" | jq 'length'
   ```

2. **Get limit from documentation:**
   - Reference: [Cosmos DB service quotas](https://learn.microsoft.com/en-us/azure/cosmos-db/concepts-limits)
   - Default limit: 50 database accounts per region

3. **Calculate availability:**
   ```
   Available = 50 - (current usage from Resource Graph)
   ```

4. **Document in provisioning checklist:**
   - Source: "Fetched from: Azure Resource Graph + Official docs" or "az resource list + Official docs"

### Azure Kubernetes Service

**Hard Limits to Check**:
- Pods per node (Azure CNI): 250
- Node pools per cluster: 100

**Quotas to Check**:
```bash
# Check AKS cluster quota
az quota usage list \
  --scope /subscriptions/{sub-id}/providers/Microsoft.ContainerService/locations/{region}
  
# Current: 12 clusters in eastus
# Limit: 5,000 clusters in eastus
# Available: 4,988 clusters
```

### Azure Storage

**Hard Limits to Check**:
- Max blob size (block): 190.7 TiB
- Max blob size (page): 8 TiB

**Quotas to Check**:
```bash
# Check storage account quota
az quota usage list \
  --scope /subscriptions/{sub-id}/providers/Microsoft.Storage/locations/{region} \
  --resource-name StorageAccounts
  
# Current: 180 accounts in eastus
# Limit: 250 accounts in eastus
# Available: 70 accounts
```

### Azure Container Apps

**Hard Limits to Check**:
- Revisions per app: 100
- HTTP request timeout: 240 seconds

**Quotas to Check**:
```bash
# Step 1: Discover quota resource name
az quota list \
  --scope /subscriptions/{sub-id}/providers/Microsoft.App/locations/{region}

# Output shows "ManagedEnvironmentCount" (not "managedEnvironments")

# Step 2: Check current usage
az quota usage show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/{sub-id}/providers/Microsoft.App/locations/{region}
# Current: 8 environments

# Step 3: Check quota limit
az quota show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/{sub-id}/providers/Microsoft.App/locations/{region}
# Limit: 50 environments

# Available: 50 - 8 = 42 environments
```

### Azure Functions

**Hard Limits to Check**:
- Execution timeout (Consumption): 10 minutes max
- Queue message size: 64 KB

**Quotas to Check**:
```bash
# Check Function Apps quota (Consumption plan)
az quota usage list \
  --scope /subscriptions/{sub-id}/providers/Microsoft.Web/locations/{region}
  
# Current: 45 function apps in eastus
# Limit: 200 function apps in eastus
# Available: 155 function apps
```

## Decision Tree for Limit Checks

```
┌─────────────────────────────────────┐
│ Planning Azure Deployment           │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Identify Services & Resource Counts  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ Check Hard Limits                    │
│ (azure-provisioning-limit skill or   │
│  azure__documentation)                │
└──────────────┬───────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ✅ Within      ❌ Exceeds
    Limits         Limits
        │             │
        │             ▼
        │         ┌───────────────────┐
        │         │ Redesign or       │
        │         │ Change Tier       │
        │         └───────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Check Quotas Across Regions          │
│ (az quota usage list)                │
└──────────────┬───────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ✅ Available   ❌ Quota
    Capacity      Exceeded
        │             │
        │             ▼
        │         ┌───────────────────┐
        │         │ Request Increase  │
        │         │ or Choose Other   │
        │         │ Region            │
        │         └───────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Present Region Recommendations       │
│ to Customer                          │
└──────────────────────────────────────┘
```

## CLI Commands Reference

> **✅ ALWAYS USE CLI FIRST**
>
> Azure CLI is the **PREFERRED** and **PRIMARY** method for checking quotas. Do NOT use REST API or Portal as the first approach.
>
> **Why CLI is preferred:**
> - Clear error messages when providers are not supported (`BadRequest`)
> - Consistent quota resource name discovery
> - Reliable current usage and limit values
> - Better handling of edge cases
>
> **If REST API or Portal shows "No Limit":** This likely means the quota API doesn't support that resource type - verify with official documentation.

> **⚠️ PREREQUISITE:** Install quota extension first:
> ```bash
> az extension add --name quota
> ```

### Discovery Workflow (ALWAYS START HERE)

```bash
# Step 1: List all quotas to discover resource names
az quota list \
  --scope /subscriptions/{subscription-id}/providers/{provider}/locations/{location}

# Supported providers:
# - Microsoft.Compute ✅
# - Microsoft.Storage ✅
# - Microsoft.App ✅ (Container Apps)
# - Microsoft.ContainerService ✅ (AKS)
# - Microsoft.Network ✅
# - Microsoft.MachineLearningServices ✅
# - Microsoft.DocumentDB ❌ (NOT supported - use docs)
# - Microsoft.Web (Functions, App Service)
```

### Check Current Usage

```bash
# Use the quota resource name from discovery (NOT the ARM resource type)
az quota usage show \
  --resource-name {quota-resource-name} \
  --scope /subscriptions/{subscription-id}/providers/{provider}/locations/{location}

# Example: Container Apps (use "ManagedEnvironmentCount" not "managedEnvironments")
az quota usage show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/{sub-id}/providers/Microsoft.App/locations/eastus
```

### Check Quota Limit

```bash
az quota show \
  --resource-name {quota-resource-name} \
  --scope /subscriptions/{subscription-id}/providers/{provider}/locations/{location}

# Example: VM vCPUs
az quota show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/{sub-id}/providers/Microsoft.Compute/locations/eastus
```

### Request Quota Increase

```bash
az quota update \
  --resource-name {quota-resource-name} \
  --scope /subscriptions/{subscription-id}/providers/{provider}/locations/{location} \
  --limit-object value={new-limit} \
  --resource-type {resource-type}
```

## Integration with azure-prepare

### When to Check Limits and Quotas

1. **After selecting services** (Step 5 in architecture planning) - Check hard limits
2. **After customer selects region** (Step 2 in execution) - Check quotas
3. **Before generating infrastructure code** (Step 3 in execution) - Validate availability

### Required Steps in azure-prepare

```markdown
## Phase 1: Planning
5. Plan Architecture
   - Select Azure services
   → CHECK HARD LIMITS HERE (check service documentation)
   - Validate architecture fits within hard limits
   - Adjust design if needed

6. Provisioning Limit Checklist - Phase 1
   - List all resources to be deployed
   - Specify deployment quantities
   - Leave quota/limit columns as "_TBD_"

## Phase 2: Execution
2. Confirm Azure Context
   - Get customer's subscription
   - Get customer's region preference

6. Provisioning Limit Checklist - Phase 2
   → **MUST INVOKE AZURE-QUOTAS SKILL FIRST** - Use quota API as the primary method
   
   ⚠️ **IMPORTANT:** Process **ONE resource type at a time**. Complete steps a-g for the first resource, then move to the next resource. Do NOT try to batch process all resources at once.
   
   For each resource type:
   a. **Try quota API first** (REQUIRED):
      az quota list --scope /subscriptions/{id}/providers/{provider}/locations/{region}
   
   b. If quota API is supported:
      - Check current usage:
        az quota usage show --resource-name {quota-name} --scope ...
      - **Check quota limit** (MUST use quota API):
        az quota show --resource-name {quota-name} --scope ...
   
   c. **ONLY if quota API is NOT supported** (BadRequest error):
      - Get current usage with Azure Resource Graph:
        az graph query -q "resources | where type == '{resource-type}' and location == '{location}' | count"
      - Or use Azure CLI resource list:
        az resource list --subscription "{id}" --resource-type "{Type}" --location "{region}"
      - Get limit from official documentation (fallback method only)
   
   d. Calculate available capacity:
      Available = Limit - (Current Usage + Planned Deployment)
   
   e. Document in provisioning checklist table:
      - Total After Deployment
      - Limit/Quota
      - Notes (source: azure-quotas, Azure Resource Graph + Official docs, or az resource list + Official docs)
   
   f. Validate all resources have sufficient capacity
   
   g. If insufficient: Request quota increase or select different region

3. Generate Artifacts
   - Only proceed after Step 6 Phase 2 is complete (NO "_TBD_" entries)
   - Plan CANNOT be presented to customer with "_TBD_" in provisioning checklist
```

## Error Messages and Remediation

| **Error Pattern** | **Type** | **Remediation** |
|-------------------|----------|-----------------|
| "Quota exceeded" | Quota | Use azure-quotas skill to request increase |
| "(BadRequest) Bad request" | Quota API not supported | Use [Azure service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) or service-specific documentation |
| "Limit exceeded" | Hard Limit | Redesign architecture or change tier |
| "Maximum size exceeded" | Hard Limit | Split data or use alternative storage |
| "Too many requests" | Rate Limit | Implement retry logic or increase tier |
| "Cannot exceed X" | Hard Limit | Stay within limit or use multiple resources |
| "Subscription limit reached" | Quota | Request quota increase using azure-quotas skill |
| "Regional capacity" | Quota | Choose different region or request increase |

## Best Practices

1. **MUST use Azure CLI quota API first**: `az quota` commands are MANDATORY as the primary method for checking quotas - only use fallback methods (REST API, Portal, docs) when quota API returns `BadRequest`
2. **Don't trust "No Limit" values**: If REST API or Portal shows "No Limit" or unlimited, verify with official service documentation - it likely means the quota API doesn't support that resource type, not that capacity is unlimited
3. **Always check after customer selects region**: Validates availability and allows time for quota requests
4. **Use the discovery workflow**: Never assume quota resource names - always run `az quota list` first to discover correct names
5. **Check both usage and limit**: Run `az quota usage show` AND `az quota show` to calculate available capacity
6. **Handle unsupported providers gracefully**: If you get `BadRequest` error, fall back to official documentation (Azure Resource Graph + docs)
7. **Request quota increases proactively**: If selected region lacks capacity, submit request before deployment
8. **Have alternative regions ready**: If quota increase denied, suggest backup regions
9. **Document capacity assumptions**: Note quota availability and source in `.azure/plan.md`
10. **Design for limits**: Architecture should account for both hard limits and quotas
11. **Monitor usage trends**: Regular quota checks help predict future needs
12. **Use lower environments wisely**: Dev/test environments count against quotas

## Quick Reference Limits

For complete quota checking workflow and commands, invoke the **azure-quotas** skill.

> **Note:** These are typical default limits. Always verify actual quotas using `az quota show` for your specific subscription and region.

Common quotas to check:

### Subscription Level
- Cosmos DB accounts: 50 per region (check via docs - quota API not supported)
- SQL logical servers: 250 per region
- Service Bus namespaces: 100-1,000 (tier dependent)

### Regional Level  
- Storage accounts: 250 per region (quota resource name: `StorageAccounts`)
- AKS clusters: 5,000 per region (quota resource name: varies by configuration)
- Container Apps environments: 50 per region (quota resource name: `ManagedEnvironmentCount`)
- Function apps: 200 per region (Consumption)

### Resource Level
- Cosmos DB containers per account: Unlimited (subject to storage)
- Apps per Container Apps environment: 500
- Databases per SQL server: 500
- Queues/topics per Service Bus namespace: 10,000

## Related Documentation

- **azure-quotas skill** - Complete quota checking workflow and CLI commands (invoke the **azure-quotas** skill)
- [Azure subscription limits](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits) - Official Microsoft documentation
- [Azure Quotas Overview](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview) - Understanding quotas and limits
- [azure-context.md](azure-context.md) - How to confirm subscription and region
- [architecture.md](architecture.md) - Architecture planning workflow

## Example: Complete Check Workflow

```bash
# Scenario: Deploying app with Cosmos DB, Storage, and Container Apps
# Customer selected region: East US

# 1. Check Hard Limits (from azure-provisioning-limit skill)
# Cosmos DB: Item size max 2 MB ✓
# Storage: Blob size max 190.7 TiB ✓
# Container Apps: Timeout 240 sec ✓

# 2. Get Customer's Region Preference
# Customer: "I prefer East US"

# 3. Check Quotas for Customer's Selected Region (East US)

# 3a. Cosmos DB - NOT SUPPORTED by quota API
az quota list \
  --scope /subscriptions/abc-123/providers/Microsoft.DocumentDB/locations/eastus
# Error: (BadRequest) Bad request

# Fallback: Get current usage with Azure Resource Graph
# Install extension first (if needed)
az extension add --name resource-graph

az graph query -q "resources | where type == 'microsoft.documentdb/databaseaccounts' and location == 'eastus' | count"
# Result: 3 database accounts currently deployed

# Or use Azure CLI resource list
az resource list \
  --subscription "abc-123" \
  --resource-type "Microsoft.DocumentDB/databaseAccounts" \
  --location "eastus" | jq 'length'
# Result: 3

# Get limit from documentation: 50 database accounts per region
# Calculate: Available = 50 - 3 = 47 ✓
# Document as: "Fetched from: Azure Resource Graph + Official docs"

# 3b. Storage Accounts
# Step 1: Discover resource name
az quota list \
  --scope /subscriptions/abc-123/providers/Microsoft.Storage/locations/eastus

# Step 2: Check usage (use discovered name "StorageAccounts")
az quota usage show \
  --resource-name StorageAccounts \
  --scope /subscriptions/abc-123/providers/Microsoft.Storage/locations/eastus
# Current: 180

# Step 3: Check limit
az quota show \
  --resource-name StorageAccounts \
  --scope /subscriptions/abc-123/providers/Microsoft.Storage/locations/eastus
# Limit: 250
# Available: 250 - 180 = 70 ✓

# 3c. Container Apps
# Step 1: Discover resource name
az quota list \
  --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus
# Shows: "ManagedEnvironmentCount"

# Step 2: Check usage
az quota usage show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus
# Current: 8

# Step 3: Check limit
az quota show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus
# Limit: 50
# Available: 50 - 8 = 42 ✓

# 4. Validate Availability
# ✅ All services have sufficient quota in East US
# ✅ Proceed with deployment

# Alternative: If quotas were insufficient
# ❌ Container Apps: 49/50 (only 1 available, need 3)
# Action: Request quota increase
# 
# az quota update \
#   --resource-name ManagedEnvironmentCount \
#   --scope /subscriptions/abc-123/providers/Microsoft.App/locations/eastus \
#   --limit-object value=100 \
#   --resource-type Microsoft.App/managedEnvironments
```

---

> **Remember**: Checking limits and quotas early prevents deployment failures and ensures smooth infrastructure provisioning.
