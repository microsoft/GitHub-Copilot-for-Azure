# Azure Bastion

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Network/bastionHosts` |
| Bicep API Version | `2024-07-01` |
| CAF Prefix | `bas` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

Azure Bastion does not use `kind`.

## SKU Names

| SKU Name | Description |
|----------|-------------|
| `Developer` | Dev/test only — single VM, no scaling, limited features |
| `Basic` | Basic — RDP/SSH, 2 instances, manual |
| `Standard` | Standard — Basic + host scaling, native client, IP-based, file transfer |
| `Premium` | Premium — Standard + session recording, private-only |

> **Note:** SKU upgrade path: Developer → Basic → Standard → Premium. Downgrade is not supported.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 80 |
| Allowed Characters | Alphanumerics, underscores, periods, hyphens. Must start with alphanumeric, end with alphanumeric or underscore. |
| Scope | Resource group |
| Pattern | `bas-{workload}-{env}-{instance}` |
| Example | `bas-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | SKU tier | `Developer`, `Basic`, `Standard`, `Premium` |
| `properties.scaleUnits` | Instance count (Standard/Premium) | `2` to `50` (default: `2`) |
| `properties.enableTunneling` | Native client support | `true`, `false` (Standard/Premium only) |
| `properties.enableIpConnect` | IP-based connection | `true`, `false` (Standard/Premium only) |
| `properties.enableFileCopy` | File transfer | `true`, `false` (Standard/Premium only) |
| `properties.enableShareableLink` | Shareable links | `true`, `false` (Standard/Premium only) |
| `properties.disableCopyPaste` | Disable clipboard | `true`, `false` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Azure Bastion has no child resource types.

## References

- [Bicep resource reference (2024-07-01)](https://learn.microsoft.com/azure/templates/microsoft.network/bastionhosts?pivots=deployment-language-bicep)
- [Azure Bastion overview](https://learn.microsoft.com/azure/bastion/bastion-overview)
- [Azure naming rules — Network](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork)
- [Bastion configuration settings](https://learn.microsoft.com/azure/bastion/configuration-settings)
