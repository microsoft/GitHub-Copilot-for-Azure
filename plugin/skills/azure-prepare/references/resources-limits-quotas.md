# Azure Resource Limits and Quotas

Check Azure resource availability during azure-prepare workflow. Validate after customer selects region.

## Types

1. **Hard Limits** - Fixed constraints that cannot be changed
2. **Quotas** - Subscription limits that can be increased via support request

**CLI First:** Always use `az quota` CLI for quota checks. Provides better error handling and consistent output. "No Limit" in REST/Portal doesn't mean unlimited - verify with service docs.

## Hard Limits

Fixed service constraints (cannot be changed).

**Check via**: `azure__documentation` tool or azure-provisioning-limit skill

**Examples**: Cosmos DB item size (2 MB), Container Apps HTTP timeout (240s), App Service Free tier deployment slots (0)

**Process**:
1. Identify services and resource sizes needed
2. Look up limits in documentation
3. Compare plan vs limits
4. If exceeded: redesign or change tier

## Quotas

Subscription/regional limits that can be increased via support request.

**Check via**: `az quota` CLI (install: `az extension add --name quota`)

**Examples**: AKS clusters (5,000/region), Storage accounts (250/region), Container Apps environments (50/region)

**Key Concept**: No 1:1 mapping between ARM resource types and quota names.
- ARM: `Microsoft.App/managedEnvironments` → Quota: `ManagedEnvironmentCount`
- ARM: `Microsoft.Compute/virtualMachines` → Quota: `standardDSv3Family`, `cores`, `virtualMachines`

**Process**:
1. Discover quota names: `az quota list --scope /subscriptions/{id}/providers/{Provider}/locations/{region}` (or invoke the **azure-quotas** skill to map ARM types to quota names).
2. Validate capacity with the [`check-quota`](#scripts) script — a single call returns limit, current usage, available capacity, total-after-deploy, and a status for every **supported** resource.
3. If insufficient: Request increase via `az quota update`.

**Unsupported Providers** (BadRequest error):

Not all providers support quota API. If `az quota list` fails with BadRequest, use fallback:

1. Get current usage:
   ```bash
   # Option A: Azure Resource Graph (recommended)
   az extension add --name resource-graph
   az graph query -q "resources | where type == '{type}' and location == '{loc}' | count"
   
   # Option B: Resource list
   az resource list --subscription "{id}" --resource-type "{Type}" --location "{loc}" | jq 'length'
   ```
2. Get limit from [service documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
3. Calculate: Available = Documented Limit - Current Usage

**Known Support Status**:
- ❌ Microsoft.DocumentDB (Cosmos DB)
- ✅ Microsoft.Compute, Microsoft.Network, Microsoft.App, Microsoft.Storage, Microsoft.MachineLearningServices

## Scripts

| Script | Purpose |
|--------|---------|
| [`scripts/check-quota.sh`](../scripts/check-quota.sh) | Validate quota capacity for a planned deployment (bash) |
| [`scripts/check-quota.ps1`](../scripts/check-quota.ps1) | Same (PowerShell) |

Pass the region plus one `provider:quota-name:count` triple per resource you intend to deploy, where **`count` is the number of additional resources to deploy** — expressed in the quota's own unit: vCPUs for VM-family quotas (e.g. 3 additional × Standard_D4s_v3 = `12`), or instance count for count-based quotas like `StorageAccounts` or `ManagedEnvironmentCount`. The script installs the `quota` extension if needed, queries the limit and current usage for each **supported** provider, computes available capacity and total-after-deploy (`usage + count`), and prints a markdown checklist table plus an overall verdict — ready to paste into the [Provisioning Limit Checklist](plan-template.md). Providers the quota API rejects (`BadRequest`, e.g. Cosmos DB) are flagged "Unsupported — see docs"; handle those with the manual fallback above.

**Example:**

```bash
./scripts/check-quota.sh eastus \
  Microsoft.App:ManagedEnvironmentCount:1 \
  Microsoft.Compute:standardDSv3Family:12 \
  Microsoft.Storage:StorageAccounts:2
```
```powershell
.\scripts\check-quota.ps1 -Region eastus -Resources `
  "Microsoft.App:ManagedEnvironmentCount:1", `
  "Microsoft.Compute:standardDSv3Family:12", `
  "Microsoft.Storage:StorageAccounts:2"
```

**Sample output:**

| Provider | Quota | Region | Limit | Usage | Need | Total After | Available | Status |
|----------|-------|--------|-------|-------|------|-------------|-----------|--------|
| Microsoft.App | ManagedEnvironmentCount | eastus | 50 | 8 | 1 | 9 | 42 | ✅ Within limit |
| Microsoft.Compute | standardDSv3Family | eastus | 350 | 50 | 12 | 62 | 300 | ✅ Within limit |
| Microsoft.Storage | StorageAccounts | eastus | 250 | 180 | 2 | 182 | 70 | ✅ Within limit |

Overall: ✅ All resources within limits.

## Workflow

**Phase 1: Identify & Check Hard Limits**
1. Analyze app requirements and select Azure services
2. Determine resource counts, sizes, tiers, throughput
3. Check hard limits via azure-provisioning-limit skill or documentation
4. Validate plan against limits; redesign if needed

**Phase 2: Check Quotas After Region Selection**
1. Get customer subscription and region preference
2. Run the [`check-quota`](#scripts) script with one `provider:quota-name:count` triple per supported resource — it returns limit, usage, and available capacity in a single call. For unsupported providers, use the BadRequest fallback above.
3. If quota exceeded: request increase or choose different region

**Phase 3: Validate Region**
- Confirm sufficient quota in selected region
- Request increases if needed
- Only proceed after validation complete

## Limit Scopes

| Scope | Example |
|-------|---------|
| Subscription | 50 Cosmos DB accounts (any region) |
| Regional | 250 storage accounts per region |
| Resource | 500 apps per Container Apps environment |

## Service Patterns

| Service | Hard Limits (examples) | Quota Check | Notes |
|---------|------------------------|-------------|-------|
| **Cosmos DB** | Item: 2MB, Partition key: 2KB, Serverless storage: 50GB | ❌ Not supported. Use Resource Graph + [docs](https://learn.microsoft.com/en-us/azure/cosmos-db/concepts-limits). Default: 50 accounts/region | Query: `az graph query -q "resources \| where type == 'microsoft.documentdb/databaseaccounts' and location == 'eastus' \| count"` |
| **AKS** | Pods/node (Azure CNI): 250, Node pools/cluster: 100 | ✅ `az quota` supported | Provider: Microsoft.ContainerService |
| **Storage** | Block blob: 190.7 TiB, Page blob: 8 TiB | ✅ Quota: `StorageAccounts` (limit: 250/region) | Provider: Microsoft.Storage |
| **Container Apps** | Revisions/app: 100, HTTP timeout: 240s | ✅ Quota: `ManagedEnvironmentCount` (limit: 50/region) | Provider: Microsoft.App |
| **Functions** | Timeout (Consumption): 10 min, Queue msg: 64KB | ✅ Check function apps quota | Provider: Microsoft.Web |

## CLI Reference

> The supported-provider limit/usage checks below are wrapped by the [`check-quota`](#scripts) script — prefer the script for capacity validation. Use these commands directly for discovery or for manual/unsupported-provider handling.

**Prerequisites**: `az extension add --name quota`

**Discovery**: List quotas to find resource names
```bash
az quota list --scope /subscriptions/{id}/providers/{provider}/locations/{location}
```

**Check Usage**:
```bash
az quota usage show --resource-name {quota-name} --scope /subscriptions/{id}/providers/{provider}/locations/{location}
```

**Check Limit**:
```bash
az quota show --resource-name {quota-name} --scope /subscriptions/{id}/providers/{provider}/locations/{location}
```

**Request Increase**:
```bash
az quota update --resource-name {quota-name} --scope /subscriptions/{id}/providers/{provider}/locations/{location} --limit-object value={new-limit} --resource-type {type}
```

## azure-prepare Integration

**When to Check**:
1. After selecting services - Check hard limits
2. After customer selects region - Check quotas
3. Before generating infrastructure code - Validate availability

**Required Steps**:

**Phase 1 - Planning**:
- Select Azure services
- Check hard limits (service documentation)
- Create provisioning limit checklist (leave quota columns as "_TBD_")

**Phase 2 - Execution**:
- Get subscription and region preference
- **Must invoke azure-quotas skill** to map ARM types to quota names (`az quota list`)
- Run the [`check-quota`](#scripts) script with one `provider:quota-name:count` triple per supported resource — it populates the checklist (limit, usage, available, total-after-deploy, status) in a single call
- For unsupported providers (BadRequest): use Resource Graph + service docs
- Document every row in the checklist (no "_TBD_" entries allowed)
- If insufficient: Request increase or change region

**Phase 3 - Generate Artifacts**:
- Only proceed after Phase 2 complete (all quotas validated)

## Error Messages

| Error | Type | Action |
|-------|------|--------|
| "Quota exceeded" | Quota | Use azure-quotas to request increase |
| "(BadRequest) Bad request" | Unsupported provider | Use [service limits docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| "Limit exceeded" | Hard Limit | Redesign or change tier |
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
9. **Document capacity assumptions**: Note quota availability and source in `.azure/deployment-plan.md`
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

# 3a. Supported providers (Storage, Container Apps) - one script call
# Discover quota names first if unknown (az quota list / azure-quotas skill),
# then validate all supported resources at once:
./scripts/check-quota.sh eastus \
  Microsoft.Storage:StorageAccounts:2 \
  Microsoft.App:ManagedEnvironmentCount:1 \
  --subscription abc-123
# Prints a checklist table + overall verdict (see Scripts section above).
# Document as: "Fetched from: check-quota script"

# 3b. Cosmos DB - NOT SUPPORTED by quota API (manual fallback)
az quota list \
  --scope /subscriptions/abc-123/providers/Microsoft.DocumentDB/locations/eastus
# Error: (BadRequest) Bad request

# Fallback: Get current usage with Azure Resource Graph
az extension add --name resource-graph
az graph query -q "resources | where type == 'microsoft.documentdb/databaseaccounts' and location == 'eastus' | count"
# Result: 3 database accounts currently deployed

# Get limit from documentation: 50 database accounts per region
# Calculate: Available = 50 - 3 = 47 ✓
# Document as: "Fetched from: Azure Resource Graph + Official docs"

# 4. Validate Availability
# ✅ All services have sufficient quota in East US
# ✅ Proceed with deployment

# Alternative: If quotas were insufficient (script reports ❌ Insufficient)
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
