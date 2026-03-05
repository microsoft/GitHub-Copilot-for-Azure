# Azure Quota CLI Commands Reference

This document provides comprehensive reference for all Azure CLI quota commands, their parameters, and usage examples.

## Overview

The `az quota` extension manages quotas for Azure resource providers. It supports **ALL** Azure services including Compute, Network, Storage, Machine Learning, HDInsight, and more.

---

## ⚠️ IMPORTANT: Install the Quota Extension First

**Before using any `az quota` commands, you MUST install the quota extension.**

This is a **REQUIRED** first step. All quota commands will fail if the extension is not installed.

```bash
# Install the quota extension (REQUIRED - do this first!)
az extension add --name quota

# Verify installation
az extension list --query "[?name=='quota']"

# Update to latest version (optional)
az extension update --name quota
```

> **Note:** The extension will auto-install on first use of any `az quota` command, but it's recommended to install it manually first to avoid delays.

---

## Understanding Resource Name Mapping

**⚠️ CRITICAL:** There is **NO 1:1 mapping** between ARM resource types and quota resource names. You cannot guess the quota resource name from the ARM resource type.

### Example Mappings

| ARM Resource Type | Quota Resource Name | How to Discover |
|-------------------|---------------------|----------------|
| `Microsoft.App/managedEnvironments` | `ManagedEnvironmentCount` | Run `az quota list` for Microsoft.App |
| `Microsoft.Compute/virtualMachines` | `standardDSv3Family`, `cores`, `virtualMachines` | Run `az quota list` for Microsoft.Compute |
| `Microsoft.Network/publicIPAddresses` | `PublicIPAddresses`, `IPv4StandardSkuPublicIpAddresses` | Run `az quota list` for Microsoft.Network |

### Discovery Workflow

**Always use this workflow to find the correct quota resource name:**

**Step 1: List all quotas for the resource provider**

```bash
az quota list \
  --scope /subscriptions/<subscription-id>/providers/<ProviderNamespace>/locations/<region>
```

**Example for Container Apps:**

```bash
az quota list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.App/locations/eastus
```

**Output:**

```json
[
  {
    "name": "ManagedEnvironmentCount",
    "properties": {
      "name": {
        "localizedValue": "Managed Environment Count",
        "value": "ManagedEnvironmentCount"
      },
      "limit": { "value": 50 }
    }
  }
]
```

**Step 2: Match by human-readable description (`localizedValue`)**

- Look for the `properties.name.localizedValue` field
- Match it to the resource type you want to deploy
- For `Microsoft.App/managedEnvironments` → look for "Managed Environment Count"

**Step 3: Use the `name` field (not ARM resource type) in subsequent commands**

```bash
# Use "ManagedEnvironmentCount" NOT "managedEnvironments"
az quota show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.App/locations/eastus

az quota usage show \
  --resource-name ManagedEnvironmentCount \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.App/locations/eastus
```

### Key Insights

1. **Never assume the resource name** - Always run `az quota list` first
2. **Read `localizedValue` for context** - It explains what the quota controls in human-readable terms
3. **Use exact `name` value** - Copy it exactly for `az quota show` and `az quota usage show` commands
4. **One ARM type can have multiple quotas** - E.g., `Microsoft.Network/publicIPAddresses` has separate quotas for IPv4, IPv6, Basic SKU, Standard SKU, etc.

---

## Command Summary

| Command | Description | Extension | Status |
|---------|-------------|-----------|--------|
| [az quota create](#az-quota-create) | Create the quota limit for the specified resource | quota | GA |
| [az quota list](#az-quota-list) | List current quota limits of all resources for the specified scope | quota | GA |
| [az quota show](#az-quota-show) | Show the quota limit of a resource | quota | GA |
| [az quota update](#az-quota-update) | Update the quota limit for a specific resource | quota | GA |
| [az quota usage list](#az-quota-usage-list) | List current usage for all resources for the scope specified | quota | GA |
| [az quota usage show](#az-quota-usage-show) | Show the current usage of a resource | quota | GA |
| [az quota request status list](#az-quota-request-status-list) | List quota requests for a one year period ending at the time is made | quota | GA |
| [az quota request status show](#az-quota-request-status-show) | Show the quota request details and status by quota request ID | quota | GA |
| [az quota operation list](#az-quota-operation-list) | List all the operations supported by the Microsoft.Quota resource provider | quota | GA |

---

## az quota create

Create the quota limit for the specified resource.

### Syntax

```bash
az quota create --resource-name RESOURCE_NAME
                --scope SCOPE
                [--limit-object LIMIT]
                [--no-wait {0, 1, f, false, n, no, t, true, y, yes}]
                [--properties PROPERTIES]
                [--resource-type RESOURCE_TYPE]
```

### Required Parameters

**`--resource-name`**

Resource name for a given resource provider.

**`--scope`**

The target Azure resource URI.

### Optional Parameters

**`--limit-object`**

The resource quota limit value. Support shorthand-syntax, json-file and yaml-file. Try "??" to show more.

**`--no-wait`**

Do not wait for the long-running operation to finish.

Accepted values: `0`, `1`, `f`, `false`, `n`, `no`, `t`, `true`, `y`, `yes`

**`--properties`**

Additional properties for the specific resource provider. Support shorthand-syntax, json-file and yaml-file. Try "??" to show more.

**`--resource-type`**

The name of the resource type. Optional field.

### Examples

**Create quota for network:**

```bash
az quota create \
  --resource-name MinPublicIpInterNetworkPrefixLength \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Network/locations/eastus \
  --limit-object value=10 \
  --resource-type MinPublicIpInterNetworkPrefixLength
```

**Create quota for network standardSkuPublicIpAddressesResource:**

```bash
az quota create \
  --resource-name StandardSkuPublicIpAddresses \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Network/locations/eastus \
  --limit-object value=10 \
  --resource-type PublicIpAddresses
```

**Create quota for compute:**

```bash
az quota create \
  --resource-name standardFSv2Family \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus \
  --limit-object value=10 \
  --resource-type dedicated
```

**Create quota for MachineLearningServices LowPriorityResource:**

```bash
az quota create \
  --resource-name TotalLowPriorityCores \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.MachineLearningServices/locations/eastus \
  --limit-object value=10 \
  --resource-type lowPriority
```

---

## az quota list

List current quota limits of all resources for the specified scope.

### Syntax

```bash
az quota list --scope SCOPE
              [--max-items MAX_ITEMS]
              [--next-token TOKEN]
```

### Required Parameters

**`--scope`**

The target Azure resource URI.

### Optional Parameters

**`--max-items`**

Total number of items to return in the command's output. If the total number of items available is more than the value specified, a token is provided in the command's output. To resume pagination, provide the token value in `--next-token` argument of a subsequent command.

**`--next-token`**

Token to specify where to start paginating. This is the token value from a previously truncated response.

### Examples

**List quota limit for compute:**

```bash
az quota list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus
```

**Example output (JSON):**

```json
[
  {
    "id": "/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus/providers/Microsoft.Quota/quotas/standardDSv3Family",
    "name": "standardDSv3Family",
    "properties": {
      "isQuotaApplicable": true,
      "limit": {
        "limitObjectType": "LimitValue",
        "limitType": "Independent",
        "value": 10
      },
      "name": {
        "localizedValue": "Standard DSv3 Family vCPUs",
        "value": "standardDSv3Family"
      },
      "properties": {},
      "unit": "Count"
    },
    "type": "Microsoft.Quota/Quotas"
  },
  {
    "id": "/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus/providers/Microsoft.Quota/quotas/standardEv3Family",
    "name": "standardEv3Family",
    "properties": {
      "isQuotaApplicable": true,
      "limit": {
        "limitObjectType": "LimitValue",
        "limitType": "Independent",
        "value": 10
      },
      "name": {
        "localizedValue": "Standard Ev3 Family vCPUs",
        "value": "standardEv3Family"
      },
      "properties": {},
      "unit": "Count"
    },
    "type": "Microsoft.Quota/Quotas"
  }
]
```

**List in table format:**

```bash
az quota list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus \
  --output table
```

**Example table output:**

```
Name
------------------------------------------
standardBSFamily
standardDSv3Family
standardDSv4Family
standardEav6Family
cores
virtualMachines
availabilitySets
virtualMachineScaleSets
dedicatedVCpus
lowPriorityCores
StandardDiskCount
PremiumDiskCount
UltraSSDDiskCount
Gallery
GalleryImage
```

**List quota limit for network:**

```bash
az quota list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Network/locations/eastus
```

**List quota limit machine learning service:**

```bash
az quota list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.MachineLearningServices/locations/eastus
```

---

## az quota show

Show the quota limit of a resource.

### Syntax

```bash
az quota show --resource-name RESOURCE_NAME
              --scope SCOPE
```

### Required Parameters

**`--resource-name`**

Resource name for a given resource provider.

**`--scope`**

The target Azure resource URI.

### Examples

**Show quota for compute:**

```bash
az quota show \
  --resource-name standardDaldv6Family \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus
```

**Example output (JSON):**

```json
{
  "id": "/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus/providers/Microsoft.Quota/quotas/standardDaldv6Family",
  "name": "standardDaldv6Family",
  "properties": {
    "isQuotaApplicable": true,
    "limit": {
      "limitObjectType": "LimitValue",
      "limitType": "Independent",
      "value": 350
    },
    "name": {
      "localizedValue": "standard Daldv6 Family vCPUs",
      "value": "standardDaldv6Family"
    },
    "properties": {},
    "unit": "Count"
  },
  "type": "Microsoft.Quota/Quotas"
}
```

**Understanding the output:**

- **`type`**: `Microsoft.Quota/Quotas` (shows quota limits)
- **`properties.limit.value`**: The quota limit (350 vCPUs in this example)
- **`properties.limit.limitType`**: Usually `Independent` for per-family quotas
- **`unit`**: Measurement unit (`Count` for vCPUs, VMs, etc.)
- This command shows the **limit only**. To see current usage, use `az quota usage show`.

**Show quota in table format:**

```bash
az quota show \
  --resource-name standardDaldv6Family \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus \
  --output table
```

---

## az quota update

Update the quota limit for a specific resource.

### Syntax

```bash
az quota update --resource-name RESOURCE_NAME
                --scope SCOPE
                [--limit-object LIMIT]
                [--no-wait {0, 1, f, false, n, no, t, true, y, yes}]
                [--properties PROPERTIES]
                [--resource-type RESOURCE_TYPE]
```

### Required Parameters

**`--resource-name`**

Resource name for a given resource provider.

**`--scope`**

The target Azure resource URI.

### Optional Parameters

**`--limit-object`**

The resource quota limit value. Support shorthand-syntax, json-file and yaml-file. Try "??" to show more.

**`--no-wait`**

Do not wait for the long-running operation to finish.

Accepted values: `0`, `1`, `f`, `false`, `n`, `no`, `t`, `true`, `y`, `yes`

**`--properties`**

Additional properties for the specific resource provider. Support shorthand-syntax, json-file and yaml-file. Try "??" to show more.

**`--resource-type`**

The name of the resource type. Optional field.

### Examples

**Update quota for compute:**

```bash
az quota update \
  --resource-name standardFSv2Family \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus \
  --limit-object value=10 \
  --resource-type dedicated
```

**Update quota for network:**

```bash
az quota update \
  --resource-name MinPublicIpInterNetworkPrefixLength \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Network/locations/eastus \
  --limit-object value=10 \
  --resource-type MinPublicIpInterNetworkPrefixLength
```

---

## az quota usage list

List current usage for all resources for the scope specified.

### Syntax

```bash
az quota usage list --scope SCOPE
                    [--max-items MAX_ITEMS]
                    [--next-token TOKEN]
```

### Required Parameters

**`--scope`**

The target Azure resource URI.

### Optional Parameters

**`--max-items`**

Total number of items to return in the command's output. If the total number of items available is more than the value specified, a token is provided in the command's output. To resume pagination, provide the token value in `--next-token` argument of a subsequent command.

**`--next-token`**

Token to specify where to start paginating. This is the token value from a previously truncated response.

### Examples

**List current usage for compute resources:**

```bash
az quota usage list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus
```

**Example output (JSON):**

```json
[
  {
    "id": "/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus/providers/Microsoft.Quota/usages/standardBSFamily",
    "name": "standardBSFamily",
    "properties": {
      "isQuotaApplicable": true,
      "name": {
        "localizedValue": "Standard BS Family vCPUs",
        "value": "standardBSFamily"
      },
      "properties": {},
      "unit": "Count",
      "usages": {
        "usagesType": "Individual",
        "value": 1
      }
    },
    "type": "Microsoft.Quota/Usages"
  },
  {
    "id": "/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus/providers/Microsoft.Quota/usages/standardDadv6Family",
    "name": "standardDadv6Family",
    "properties": {
      "isQuotaApplicable": true,
      "name": {
        "localizedValue": "standard Dadv6 Family vCPUs",
        "value": "standardDadv6Family"
      },
      "properties": {},
      "unit": "Count",
      "usages": {
        "usagesType": "Individual",
        "value": 4
      }
    },
    "type": "Microsoft.Quota/Usages"
  },
  {
    "id": "/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus/providers/Microsoft.Quota/usages/standardDaldv6Family",
    "name": "standardDaldv6Family",
    "properties": {
      "isQuotaApplicable": true,
      "name": {
        "localizedValue": "standard Daldv6 Family vCPUs",
        "value": "standardDaldv6Family"
      },
      "properties": {},
      "unit": "Count",
      "usages": {
        "usagesType": "Individual",
        "value": 12
      }
    },
    "type": "Microsoft.Quota/Usages"
  }
]
```

**Understanding the output:**

- **`type`**: `Microsoft.Quota/Usages` (different from `az quota list` which returns `Microsoft.Quota/Quotas`)
- **`properties.usages.value`**: Shows the **current usage** (how many resources are currently deployed)
- **`properties.usages.usagesType`**: Typically `Individual` for per-resource usage
- This command shows **usage only**, not the quota limit. Use `az quota show` to see both usage and limit together.

**List in table format:**

```bash
az quota usage list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus \
  --output table
```

**Example table output:**

```
Name
------------------------------------------
standardBSFamily
standardDadv6Family
standardDaldv6Family
standardDalv6Family
standardDSv3Family
standardDSv4Family
cores
virtualMachines
availabilitySets
virtualMachineScaleSets
lowPriorityCores
```

**List current usage for network resources:**

```bash
az quota usage list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Network/locations/eastus
```

---

## az quota usage show

Show the current usage of a resource.

### Syntax

```bash
az quota usage show --resource-name RESOURCE_NAME
                    --scope SCOPE
```

### Required Parameters

**`--resource-name`**

Resource name for a given resource provider.

**`--scope`**

The target Azure resource URI.

### Examples

**Show current usage for a specific compute resource:**

```bash
az quota usage show \
  --resource-name standardDaldv6Family \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus
```

**Example output (JSON):**

```json
{
  "id": "/subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus/providers/Microsoft.Quota/usages/standardDaldv6Family",
  "name": "standardDaldv6Family",
  "properties": {
    "isQuotaApplicable": true,
    "name": {
      "localizedValue": "standard Daldv6 Family vCPUs",
      "value": "standardDaldv6Family"
    },
    "properties": {},
    "unit": "Count",
    "usages": {
      "usagesType": "Individual",
      "value": 12
    }
  },
  "type": "Microsoft.Quota/Usages"
}
```

**Understanding the output:**

- **`type`**: `Microsoft.Quota/Usages` (shows current usage, not limits)
- **`properties.usages.value`**: Current usage (12 vCPUs in use in this example)
- **`properties.usages.usagesType`**: Typically `Individual` for per-resource usage
- This command shows **current usage only**. To see the quota limit, use `az quota show`.
- To calculate **available capacity**: Use `az quota show` to get the limit, then subtract the usage value.

**Example: Calculating available capacity**

For `standardDaldv6Family`:
- Quota Limit (from `az quota show`): 350 vCPUs
- Current Usage (from `az quota usage show`): 12 vCPUs  
- **Available**: 338 vCPUs (350 - 12)

**Show usage in table format:**

```bash
az quota usage show \
  --resource-name standardDaldv6Family \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus \
  --output table
```

---

## az quota request status list

For the specified scope, get the current quota requests for a one year period ending at the time is made. Use the oData filter to select quota requests.

### Syntax

```bash
az quota request status list --scope SCOPE
                             [--filter FILTER]
                             [--max-items MAX_ITEMS]
                             [--next-token TOKEN]
                             [--skip-token SKIP_TOKEN]
                             [--top TOP]
```

### Required Parameters

**`--scope`**

The target Azure resource URI.

### Optional Parameters

**`--filter`**

| Field                    | Supported operators |
|--------------------------|---------------------|
| requestSubmitTime        | ge, le, eq          |
| provisioningState        | eq                  |
| resourceName             | eq                  |

**`--max-items`**

Total number of items to return in the command's output. If the total number of items available is more than the value specified, a token is provided in the command's output. To resume pagination, provide the token value in `--next-token` argument of a subsequent command.

**`--next-token`**

Token to specify where to start paginating. This is the token value from a previously truncated response.

**`--skip-token`**

The **$skiptoken** is supported on get list of Current Quota requests, which provides the next page in the list of quota requests.

**`--top`**

Number of records to return.

### Examples

**List quota requests for compute:**

```bash
az quota request status list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus
```

**List quota requests for network:**

```bash
az quota request status list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Network/locations/eastus
```

---

## az quota request status show

Get the quota request details and status by quota request ID for the resources of the resource provider at a specific location. The quota request ID **id** is returned in the response of the PUT operation.

### Syntax

```bash
az quota request status show --id REQUEST_ID
                             --scope SCOPE
```

### Required Parameters

**`--id`**

Quota request ID.

**`--scope`**

The target Azure resource URI.

### Examples

**Show quota request status:**

```bash
az quota request status show \
  --id 2B5C8515-37D8-4B6A-879B-CD641A2CF605 \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.Compute/locations/eastus
```

---

## az quota operation list

List all the operations supported by the Microsoft.Quota resource provider.

### Syntax

```bash
az quota operation list
```

### Examples

**List all operations:**

```bash
az quota operation list
```

**List operations with table output:**

```bash
az quota operation list --output table
```

---

## Troubleshooting

### Unsupported Resource Types

**Important:** Not all Azure resource providers support the quota API. If you receive a `BadRequest` error when running `az quota list`, there is a high chance that the quota API does not support that resource type.

#### Example: Microsoft.DocumentDB (Cosmos DB)

Attempting to list quotas for Cosmos DB resources will fail:

```bash
az quota list \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000/providers/Microsoft.DocumentDB/locations/eastus
```

**Error output:**

```
(BadRequest) Bad request
Code: BadRequest
Message: Bad request
```

**Why this happens:**

The Azure Quota API has limited resource provider support. While it works well for compute, network, storage, and machine learning resources, many other Azure services do not expose their quotas through this API.

#### Workarounds for Unsupported Resource Types

**Check Azure Documentation:**

- [Azure subscription and service limits, quotas, and constraints](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
- Service-specific documentation for quota limits

#### Known Unsupported Resource Providers

❌ **Microsoft.DocumentDB** - Cosmos DB database accounts (use Portal or REST API instead)

**Testing a new resource provider:**

To test if a resource provider supports quota commands:

```bash
# Try listing quotas for the provider
az quota list \
  --scope /subscriptions/<subscription-id>/providers/<ProviderNamespace>/locations/<region>

# If you get BadRequest error → provider is not supported
# If you get a list of quotas → provider is supported
```

### Common Error Codes

| **Error** | **Cause** | **Solution** |
|-----------|-----------|-------------|
| `BadRequest` | Resource provider not supported by quota API | Use Azure Portal, service-specific REST API, or documentation |
| `ExtensionNotFound` | Quota extension not installed | Run `az extension add --name quota` |
| `MissingRegistration` | Microsoft.Quota provider not registered | Run `az provider register --namespace Microsoft.Quota` |
| `InvalidScope` | Incorrect scope format | Verify scope pattern: `/subscriptions/<id>/providers/<namespace>/locations/<region>` |
| `QuotaNotAvailableForResource` | Resource not available in region | Try different region or check service availability |
| `RequestThrottled` | Too many API calls | Implement exponential backoff retry logic |
