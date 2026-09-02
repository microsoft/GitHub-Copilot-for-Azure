# Azure Quota CLI Command Reference

Use this reference for Azure CLI quota commands.

## Prerequisites

Install the quota extension:

```bash
az extension add --name quota
```

> ⚠️ **Use Azure CLI first.**
>
> 1. Run `az quota list`, `az quota show`, or `az quota usage show`.
> 2. If the command returns `BadRequest`, use the [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits).
> 3. Use the REST API or the Azure portal only as a fallback.
>
> The REST API and the portal can show `No Limit` or `Unlimited`. These values do not mean that capacity is unlimited.
> The quota API can return these values when it does not support a resource type.
> Service-specific limits and regional capacity limits can still apply.

## Resource Name Mapping

An ARM resource type does not map directly to one quota resource name. Use `az quota list` to find the name.

1. List all quotas:

   ```bash
   az quota list --scope /subscriptions/{id}/providers/{Provider}/locations/{region}
   ```

2. Match `properties.name.localizedValue` to the applicable resource type.
3. Use the exact `name` value in later commands.

Example mappings:

| ARM type | Quota name |
|---|---|
| `Microsoft.App/managedEnvironments` | `ManagedEnvironmentCount` |
| `Microsoft.Compute/virtualMachines` | `standardDSv3Family`, `cores`, `virtualMachines` |
| `Microsoft.Network/publicIPAddresses` | `PublicIPAddresses`, `IPv4StandardSkuPublicIpAddresses` |

## Command Summary

| Command | Purpose |
|---|---|
| [az quota list](#az-quota-list) | List all quota limits for a scope. |
| [az quota show](#az-quota-show) | Show the quota limit for one resource. |
| [az quota usage list](#az-quota-usage-list) | List current usage for all resources. |
| [az quota usage show](#az-quota-usage-show) | Show current usage for one resource. |
| [az quota update](#az-quota-update) | Request a quota increase. |
| [az quota create](#az-quota-create) | Create a quota limit. |

See [advanced-commands.md](advanced-commands.md) for request status and operation commands.

---

## az quota list

Use this command first. It lists quota limits and identifies quota resource names.

Syntax:

```bash
az quota list --scope SCOPE [--max-items N] [--next-token TOKEN]
```

Required parameter:

- `--scope`: Azure resource URI in the form `/subscriptions/{id}/providers/{Provider}/locations/{region}`

Examples:

```bash
# List compute quotas.
az quota list --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus

# List network quotas.
az quota list --scope /subscriptions/{id}/providers/Microsoft.Network/locations/eastus

# Show compute quotas in a table.
az quota list --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus --output table
```

Key output fields:

- `name`: Quota resource name. Use this value in other commands.
- `properties.name.localizedValue`: Human-readable description.
- `properties.limit.value`: Quota limit.

---

## az quota show

Use this command to show the quota limit for one resource.

Syntax:

```bash
az quota show --resource-name NAME --scope SCOPE
```

Required parameters:

- `--resource-name`: Quota resource name from `az quota list`.
- `--scope`: Azure resource URI.

Example:

```bash
# Get the DSv3-family vCPU limit.
az quota show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus
```

Key output fields:

- `properties.limit.value`: Quota limit.
- `properties.name.localizedValue`: Human-readable description.
- `properties.quotaPeriod`: Reset period. For example, `P1M` means one month.

---

## az quota update

Use this command to request a quota increase.

Syntax:

```bash
az quota update --resource-name NAME --scope SCOPE --limit-object value=N [--resource-type TYPE] [--no-wait]
```

Required parameters:

- `--resource-name`: Quota resource name.
- `--scope`: Azure resource URI.
- `--limit-object`: New limit in the form `value=N`.

Optional parameters:

- `--resource-type`: Resource type, such as `dedicated` or `lowPriority`.
- `--no-wait`: Do not wait for the operation to finish.

Examples:

```bash
# Increase FSv2-family vCPUs to 100.
az quota update \
  --resource-name standardFSv2Family \
  --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus \
  --limit-object value=100 \
  --resource-type dedicated

# Submit the request without waiting.
az quota update \
  --resource-name standardFSv2Family \
  --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus \
  --limit-object value=100 \
  --no-wait true
```

---

## az quota usage list

Use this command to list current usage for all resources in a scope.

Syntax:

```bash
az quota usage list --scope SCOPE [--max-items N] [--next-token TOKEN]
```

Required parameter:

- `--scope`: Azure resource URI.

Examples:

```bash
# List compute usage.
az quota usage list --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus

# Show compute usage in a table.
az quota usage list --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus --output table
```

The `properties.usages.value` field contains current usage. Compare this value with `az quota show` to calculate available capacity.

---

## az quota usage show

Use this command to show current usage for one resource.

Syntax:

```bash
az quota usage show --resource-name NAME --scope SCOPE
```

Required parameters:

- `--resource-name`: Quota resource name.
- `--scope`: Azure resource URI.

Example:

```bash
az quota usage show \
  --resource-name standardDSv3Family \
  --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus
```

Calculate available capacity:

1. Get the limit with `az quota show --resource-name {name} --scope {scope}`.
2. Get usage with `az quota usage show --resource-name {name} --scope {scope}`.
3. Subtract usage from the limit.

Example:

- Limit: 350 vCPUs.
- Usage: 12 vCPUs.
- Available capacity: 338 vCPUs.

---

## az quota create

Use this command to create a quota limit. This command is uncommon. Usually, use `az quota update`.

Syntax:

```bash
az quota create --resource-name NAME --scope SCOPE --limit-object value=N [--resource-type TYPE]
```

Required parameters:

- `--resource-name`: Quota resource name.
- `--scope`: Azure resource URI.
- `--limit-object`: Quota limit value.

Examples:

```bash
# Create a network quota.
az quota create \
  --resource-name MinPublicIpInterNetworkPrefixLength \
  --scope /subscriptions/{id}/providers/Microsoft.Network/locations/eastus \
  --limit-object value=10 \
  --resource-type MinPublicIpInterNetworkPrefixLength

# Create a machine-learning quota.
az quota create \
  --resource-name TotalLowPriorityCores \
  --scope /subscriptions/{id}/providers/Microsoft.MachineLearningServices/locations/eastus \
  --limit-object value=10 \
  --resource-type lowPriority
```

---

## Troubleshooting

### Unsupported Resource Types

Some Azure resource providers do not support the quota API. A `BadRequest` response from `az quota list` can identify an unsupported provider.

Example for `Microsoft.DocumentDB`:

```bash
az quota list --scope /subscriptions/{id}/providers/Microsoft.DocumentDB/locations/eastus
# Error: (BadRequest) Bad request
```

If the provider is unsupported:

- Check the [Azure subscription limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits).
- Use the Azure portal for quota management.
- Check the service documentation.

Test provider support:

```bash
az quota list --scope /subscriptions/{id}/providers/{Provider}/locations/{region}

# BadRequest: The provider is not supported.
# A quota list: The provider is supported.
```

### REST API "No Limit" Warning

> ⚠️ **Do not interpret `No Limit` as unlimited capacity.**
>
> `No Limit`, `Unlimited`, and similar values can have these causes:
>
> - The quota API does not support the resource provider.
> - The API cannot supply quota information.
> - Azure manages the quota at a different scope.
>
> Use `az quota` first. If it returns `BadRequest`, check the [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits).
> Also check the service documentation and regional capacity.

### Common Error Codes

| Error | Cause | Corrective action |
|---|---|---|
| `BadRequest` | The quota API does not support the provider. | Check the [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits). |
| `ExtensionNotFound` | The quota extension is not installed. | Run `az extension add --name quota`. |
| `MissingRegistration` | The `Microsoft.Quota` provider is not registered. | Run `az provider register --namespace Microsoft.Quota`. |
| `InvalidScope` | The scope has an incorrect format. | Use `/subscriptions/{id}/providers/{namespace}/locations/{region}`. |
| `QuotaNotAvailableForResource` | The resource is not available in the region. | Select a different region. |
| `RequestThrottled` | The client sent too many API calls. | Use exponential backoff. |

### Known Support Status

Unsupported:

- ❌ `Microsoft.DocumentDB` for Cosmos DB

Supported:

- ✅ `Microsoft.Compute` for VMs, disks, and cores
- ✅ `Microsoft.Network` for virtual networks, IP addresses, and load balancers
- ✅ `Microsoft.App` for Container Apps
- ✅ `Microsoft.Storage` for storage accounts
- ✅ `Microsoft.MachineLearningServices`
- ✅ `Microsoft.ContainerService` for AKS
