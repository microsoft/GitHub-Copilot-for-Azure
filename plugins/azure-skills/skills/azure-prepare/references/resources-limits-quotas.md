# Azure Resource Limits and Quotas

Check Azure resource availability during azure-prepare workflow. Validate after customer selects region.

## Types

1. **Hard Limits** - Fixed constraints that cannot be changed
2. **Quotas** - Subscription limits that can be increased via support request

**Script first:** Use the bundled [Bash](../scripts/check-quota.sh) or [PowerShell](../scripts/check-quota.ps1) quota checker. The scripts use Azure CLI quota APIs first and return compact, consistent results. "No Limit" in REST/Portal does not mean unlimited; verify unsupported providers with service documentation.

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

**Check via**: bundled quota-check script

**Examples**: AKS clusters (5,000/region), Storage accounts (250/region), Container Apps environments (50/region)

**Key Concept**: No 1:1 mapping between ARM resource types and quota names.
- ARM: `Microsoft.App/managedEnvironments` → Quota: `ManagedEnvironmentCount`
- ARM: `Microsoft.Compute/virtualMachines` → Quota: `standardDSv3Family`, `cores`, `virtualMachines`

**Process**:
1. Build the deployment requirements JSON after the subscription and region are selected.
2. Run the bundled script once for all resource requirements.
3. Copy each result row and the overall verdict into the provisioning checklist.
4. If capacity is insufficient, request an increase or choose another region.

**Unsupported Providers** (BadRequest error):

Not all providers support quota API. For those requirements, include `resourceType` and a `documentedLimit` obtained from [official service-limit documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits). On `BadRequest`, the script counts existing resources with Azure Resource Graph and uses that documented limit. Any other CLI error fails the check.

**Known Support Status**:
- ❌ Microsoft.DocumentDB (Cosmos DB)
- ✅ Microsoft.Compute, Microsoft.Network, Microsoft.App, Microsoft.Storage, Microsoft.MachineLearningServices

## Workflow

**Phase 1: Identify & Check Hard Limits**
1. Analyze app requirements and select Azure services
2. Determine resource counts, sizes, tiers, throughput
3. Check hard limits via azure-provisioning-limit skill or documentation
4. Validate plan against limits; redesign if needed

**Phase 2: Check Quotas After Region Selection**
1. Get customer subscription and region preference
2. Create one requirements file covering every resource to deploy
3. Run the bundled quota-check script
4. Record usage, projected usage, limit, available capacity, and status
5. If quota exceeded: request increase or choose different region

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

## Script Reference

Create a JSON array such as:

```json
[
  {"provider":"Microsoft.App","resourceName":"ManagedEnvironmentCount","requested":1},
  {"provider":"Microsoft.DocumentDB","resourceName":"databaseAccounts","requested":1,"resourceType":"Microsoft.DocumentDB/databaseAccounts","documentedLimit":50}
]
```

Run from the `azure-prepare` skill root:

```bash
./scripts/check-quota.sh --region eastus2 --requirements-file requirements.json
```

```powershell
.\scripts\check-quota.ps1 -Region eastus2 -RequirementsFile requirements.json
```

Pass the subscription explicitly with `--subscription-id <id>` or `-SubscriptionId <id>`; otherwise the scripts use the current Azure CLI subscription. Exit code `0` means `pass` or `near-limit`, `1` means insufficient capacity or an operational failure, and `2` means invalid arguments. `near-limit` means projected usage is at least 80% of the limit.

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
- Invoke the **azure-quotas** skill for quota guidance.
- Run the bundled quota-check script once with the complete requirements file.
- For unsupported providers, supply the ARM resource type and documented limit.
- Document every result in the checklist; no `_TBD_` entries are allowed.
- If the overall verdict is `insufficient`, request an increase or change region.

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

1. **MUST use the bundled script**: It uses Azure CLI quota APIs first and only uses Resource Graph fallback when quota discovery returns `BadRequest`.
2. **Don't trust "No Limit" values**: If REST API or Portal shows "No Limit" or unlimited, verify with official service documentation - it likely means the quota API doesn't support that resource type, not that capacity is unlimited
3. **Always check after customer selects region**: Validates availability and allows time for quota requests
4. **Use the discovery workflow**: Never assume quota resource names; the script verifies them with `az quota list`.
5. **Check both usage and limit**: The script retrieves both values and calculates projected and available capacity.
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

## Result Handling

Copy each script row into the provisioning checklist. A `pass` verdict permits generation, `near-limit` permits generation with a warning and documented mitigation, and `insufficient` blocks generation until the quota is increased or the plan uses another region or SKU.

---

> **Remember**: Checking limits and quotas early prevents deployment failures and ensures smooth infrastructure provisioning.
