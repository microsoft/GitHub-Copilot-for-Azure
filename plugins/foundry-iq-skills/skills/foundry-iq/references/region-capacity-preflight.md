# Region and capacity preflight

Select regions before creating resources. A successful read-only preflight proves
that a region supports the required Search features and that the subscription has
quota headroom. It does **not** prove that Azure has physical capacity to allocate
the requested SKU at creation time.

## Build the candidate set

Start with regions allowed by policy, residency, sovereignty, and the workload's
latency requirements. Keep only regions where the application, data sources,
Azure AI Search features, and required Foundry or Azure OpenAI models can be
co-located or where cross-region processing is explicitly approved.

Do not silently choose a different geography. Before mutation, include the
ordered primary and fallback regions in the approval plan.

Read the current Azure AI Search regional-support table and its capacity
footnotes immediately before provisioning. Exclude any region marked as high
demand or unavailable for new services even when its quota API reports
headroom. The documentation can lag real allocation state, so this is a filter,
not a guarantee.

## Query Search support and quota

Use the Search Management APIs through the authenticated Azure CLI:

```powershell
$subscription = (az account show --output json | ConvertFrom-Json).id
$region = "eastus2"
$sku = "basic"

$offerings = az rest --method get --url `
  "https://management.azure.com/providers/Microsoft.Search/offerings?api-version=2025-02-01-preview" `
  --output json | ConvertFrom-Json
$regionOffering = $offerings.value |
  Where-Object { $_.regionName -eq $region }

$usage = az rest --method get --url `
  "https://management.azure.com/subscriptions/$subscription/providers/Microsoft.Search/locations/$region/usages?api-version=2025-05-01" `
  --output json | ConvertFrom-Json
$skuUsage = $usage.value |
  Where-Object { $_.name.value -eq $sku }

[pscustomobject]@{
  region = $region
  sku = $sku
  features = @($regionOffering.features.name)
  quota_used = $skuUsage.currentValue
  quota_limit = $skuUsage.limit
  quota_headroom = $skuUsage.limit - $skuUsage.currentValue
  live_allocation_capacity = "unknown-until-create"
}
```

Repeat the read-only query for each approved candidate. Reject a candidate when
the required feature is absent, the SKU usage record is absent, or quota headroom
is zero. Check required model availability and quota separately; Search quota
does not imply model capacity.

## Handle allocation failure

The create operation is the only authoritative live-capacity probe. On
`ResourcesForSkuUnavailable`, `InsufficientResourcesAvailable`, or an Azure
response that explicitly says an internal error occurred and to try again later:

1. retain the original request ID and diagnostic;
2. clean up only resources owned by the failed attempt;
3. retry for a short bounded window when the region must be preserved;
4. otherwise try the next pre-approved compatible region;
5. keep SKU, identity, network, and local-auth posture unchanged unless a
   separate approved requirement changes them.

Do not treat quota headroom as guaranteed capacity, request quota to solve a
physical-capacity shortage, or weaken security to make provisioning succeed.
If all approved candidates fail, stop and report the capacity constraint.

For benchmarks, region is part of the execution stratum. Never fill missing
pairs from another region: start a complete procedure sample in the alternative
region and report the regions as separate strata.

Sources:

- https://learn.microsoft.com/en-us/rest/api/searchmanagement/offerings/list
- https://learn.microsoft.com/en-us/rest/api/searchmanagement/usages/list-by-subscription
- https://learn.microsoft.com/en-us/azure/search/search-region-capacity
- https://learn.microsoft.com/en-us/azure/search/search-region-support
