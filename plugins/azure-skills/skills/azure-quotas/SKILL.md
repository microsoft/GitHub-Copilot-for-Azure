---
name: azure-quotas
description: "Check/manage Azure quotas and usage across providers. For deployment planning, capacity validation, region selection. WHEN: \"check quotas\", \"service limits\", \"current usage\", \"request quota increase\", \"quota exceeded\", \"validate capacity\", \"regional availability\", \"provisioning limits\", \"vCPU limit\", \"how many vCPUs available in my subscription\"."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Quotas - Service Limits and Capacity Management

> **Authoritative guidance:** Follow these instructions for quota management and capacity checks.

## Overview

Azure quotas are also called service limits. A quota sets the maximum number of resources for a subscription.

Quotas have these purposes:

- They prevent accidental over-provisioning.
- They distribute Azure resources fairly.
- They show available capacity in each region.
- Some quotas are adjustable. Other quotas are fixed.

You cannot deploy a resource when the subscription has insufficient quota. Check quotas before you plan a deployment or select a region.

## When to Use This Skill

Use this skill for these tasks:

- Check capacity before a deployment.
- Compare quota availability across regions.
- Investigate a `QuotaExceeded` error.
- Request a quota increase.
- Compare regional capacity.
- Check that a deployment stays within its limits.

## Quick Reference

| Property | Details |
|---|---|
| Primary tool | Use Azure CLI commands in the `az quota` group first. |
| Required extension | Install it with `az extension add --name quota`. |
| Key commands | `az quota list`, `az quota show`, `az quota usage list`, `az quota usage show` |
| Complete CLI reference | [commands.md](./references/commands.md) |
| Azure portal | Use [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) only as a fallback. |
| REST API | The `Microsoft.Quota` provider can give unreliable results. Do not use it first. |
| MCP server | Do not use the `azure-quota` MCP server. Use Azure CLI instead. |
| Required permission | Use Reader to view quotas. Use Quota Request Operator to manage quotas. |

> ⚠️ **Use Azure CLI first.**
>
> The REST API and the portal can show `No Limit`. This value does not mean that capacity is unlimited.
> It usually means that the quota API does not support the resource type.
> If Azure CLI returns `BadRequest`, use the [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits).
> For all command details, see [commands.md](./references/commands.md).

## Quota Types

| Type | Can you change it? | Approval | Examples |
|---|---|---|---|
| Adjustable | Yes. Use the portal, Azure CLI, or the API. | Azure usually approves it automatically. | VM vCPUs, public IP addresses, storage accounts |
| Non-adjustable | No. The limit is fixed. | Not applicable | Subscription-wide hard limits |

A quota increase is free. You pay only for resources that you use.

## Understanding Resource Name Mapping

An ARM resource type does not map directly to one quota resource name.

### Example Mappings

| ARM resource type | Quota resource name |
|---|---|
| `Microsoft.App/managedEnvironments` | `ManagedEnvironmentCount` |
| `Microsoft.Compute/virtualMachines` | `standardDSv3Family`, `cores`, `virtualMachines` |
| `Microsoft.Network/publicIPAddresses` | `PublicIPAddresses`, `IPv4StandardSkuPublicIpAddresses` |

### Discovery Workflow

Do not derive a quota resource name from an ARM resource type.

1. List all quotas for the resource provider:

   ```bash
   az quota list --scope /subscriptions/<id>/providers/<ProviderNamespace>/locations/<region>
   ```

2. Find the applicable quota by its `localizedValue`.
3. Use the quota `name` in later commands:

   ```bash
   az quota show --resource-name ManagedEnvironmentCount --scope ...
   az quota usage show --resource-name ManagedEnvironmentCount --scope ...
   ```

For more examples, see [Resource Name Mapping](./references/commands.md#resource-name-mapping).

## Scripts

Use the supplied scripts instead of manual commands. Each script installs the extension, gets usage, and calculates available capacity.

| Script | Purpose |
|---|---|
| `scripts/check-quota.ps1` | Check all quotas, or check one named quota, from PowerShell. |
| `scripts/check-quota.sh` | Check all quotas, or check one named quota, from Bash. |

Run script commands from the skill root.

## Core Workflows

### Workflow 1: Check Quota for a Specific Resource

Use this workflow to check capacity before a deployment.

1. Supply the resource provider and region:

   ```powershell
   .\scripts\check-quota.ps1 -ResourceProvider <provider> -Region <region>
   ```

   ```bash
   ./scripts/check-quota.sh <provider> <region>
   ```

2. To check one resource, also supply its quota resource name:

   ```powershell
   .\scripts\check-quota.ps1 -ResourceProvider <provider> -Region <region> -ResourceName <resource-name>
   ```

   ```bash
   ./scripts/check-quota.sh <provider> <region> <resource-name>
   ```

Example:

```powershell
.\scripts\check-quota.ps1 -ResourceProvider Microsoft.Compute -Region eastus
```

Example output:

| Resource | Region | Limit | Usage | Available |
|---|---|---:|---:|---:|
| cores | eastus | 100 | 50 | 50 |
| standardDSv3Family | eastus | 350 | 50 | 300 |
| virtualMachines | eastus | 25000 | 5 | 24995 |

See [az quota show](./references/commands.md#az-quota-show) and [az quota usage show](./references/commands.md#az-quota-usage-show).

### Workflow 2: Compare Quotas Across Regions

Use this workflow to find a region that has sufficient capacity.

```bash
# Define candidate regions.
REGIONS=("eastus" "eastus2" "westus2" "centralus")
VM_FAMILY="standardDSv3Family"
SUBSCRIPTION_ID="<subscription-id>"

# Check quota availability in each region.
for region in "${REGIONS[@]}"; do
  echo "=== Checking $region ==="

  # Get the limit.
  LIMIT=$(az quota show \
    --resource-name $VM_FAMILY \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.limit.value" -o tsv)

  # Get current usage.
  USAGE=$(az quota usage show \
    --resource-name $VM_FAMILY \
    --scope "/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.Compute/locations/$region" \
    --query "properties.usages.value" -o tsv)

  # Calculate available capacity.
  AVAILABLE=$((LIMIT - USAGE))

  echo "Region: $region | Limit: $LIMIT | Usage: $USAGE | Available: $AVAILABLE"
done
```

See [az quota show](./references/commands.md#az-quota-show) for more command patterns.

### Workflow 3: Request Quota Increase

Use this workflow when the current quota is insufficient.

1. Request the increase:

   ```bash
   az quota update \
     --resource-name standardDSv3Family \
     --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus \
     --limit-object value=500 \
     --resource-type dedicated
   ```

2. Check the request status:

   ```bash
   az quota request status list \
     --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus
   ```

Azure approves most adjustable quotas within minutes. Some requests need a manual review, which can take hours or days.
For a non-adjustable quota, open an Azure support request.

See [az quota update](./references/commands.md#az-quota-update) and [az quota request status](./references/advanced-commands.md#az-quota-request-status-list).

### Workflow 4: List All Quotas for Planning

Use this workflow to list all quotas for one provider and region.

```bash
# List compute quotas in East US.
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Compute/locations/eastus \
  --output table

# List network quotas.
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.Network/locations/eastus \
  --output table

# List Container Apps quotas.
az quota list \
  --scope /subscriptions/<subscription-id>/providers/Microsoft.App/locations/eastus \
  --output table
```

See [az quota list](./references/commands.md#az-quota-list).

## Troubleshooting

### Common Errors

| Error | Cause | Corrective action |
|---|---|---|
| REST API returns `No Limit` | The result is misleading. It does not mean unlimited capacity. | Use Azure CLI. See the warning in Quick Reference. |
| `ExtensionNotFound` | The quota extension is not installed. | Run `az extension add --name quota`. |
| `BadRequest` | The quota API does not support the resource provider. | Check the [service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits). |
| `MissingRegistration` | The `Microsoft.Quota` provider is not registered. | Run `az provider register --namespace Microsoft.Quota`. |
| `QuotaExceeded` | The deployment needs more quota. | Request an increase or select a different region. |
| `InvalidScope` | The scope has an incorrect format. | Use `/subscriptions/<id>/providers/<namespace>/locations/<region>`. |
| All CLI commands fail | Authentication, the extension, or the network has a problem. | Run `az account show`. Reinstall the extension. Check the network. Do not use the `azure-quota` MCP server. |

### Unsupported Resource Providers

Known unsupported provider:

- ❌ `Microsoft.DocumentDB` (Cosmos DB): Use the portal or the [Cosmos DB limits documentation](https://learn.microsoft.com/en-us/azure/cosmos-db/concepts-limits).

Confirmed supported providers:

- ✅ `Microsoft.Compute` for VMs, disks, and cores
- ✅ `Microsoft.Network` for virtual networks, IP addresses, and load balancers
- ✅ `Microsoft.App` for Container Apps
- ✅ `Microsoft.Storage` for storage accounts
- ✅ `Microsoft.MachineLearningServices` for machine learning compute

See the [Troubleshooting Guide](./references/commands.md#troubleshooting).

## Additional Resources

| Resource | Link |
|---|---|
| CLI command reference | [commands.md](./references/commands.md) |
| Azure Quotas overview | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/quotas/quotas-overview) |
| Service limits | [Azure subscription limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits) |
| Azure portal quotas | [My quotas](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas) |
| Quota increase instructions | [How to request increases](https://learn.microsoft.com/en-us/azure/quotas/quickstart-increase-quota-portal) |

## Best Practices

1. Check quotas before each deployment.
2. Run `az quota list` first to find the correct quota resource names.
3. Compare regions to find available capacity.
4. Request 20 percent more than the immediate requirement.
5. Use `--output table` for a short overview.
6. Use the portal to set usage alerts at 80 percent.
