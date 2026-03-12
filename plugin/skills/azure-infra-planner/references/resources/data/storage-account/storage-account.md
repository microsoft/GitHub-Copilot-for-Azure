# Storage Account

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Storage/storageAccounts` |
| Bicep API Version | `2025-01-01` |
| CAF Prefix | `st` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

These are the exact `kind` values accepted in Bicep. Using any other value causes deployment failure.

| Kind | Description | Access Tier Support |
|------|-------------|---------------------|
| `StorageV2` | General-purpose v2 — **recommended default** | Hot, Cool, Cold |
| `Storage` | General-purpose v1 (legacy) | N/A |
| `BlobStorage` | Blob-only (legacy, use StorageV2 instead) | Hot, Cool |
| `BlockBlobStorage` | Premium block blob | Premium (fixed) |
| `FileStorage` | Premium file shares only | Premium (fixed) |

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 24 |
| Allowed Characters | Lowercase letters and numbers only (no hyphens, no underscores) |
| Scope | Global (must be globally unique) |
| Pattern | `st{workload}{env}{instance}` (no separators) |
| Example | `stdatapipelineprod001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.accessTier` | Billing tier for blobs | `Hot`, `Cool`, `Cold`, `Premium` |
| `properties.allowBlobPublicAccess` | Allow anonymous blob access | `true`, `false` (default: `false`) |
| `properties.supportsHttpsTrafficOnly` | Require HTTPS | `true` (recommended), `false` |
| `properties.minimumTlsVersion` | Minimum TLS version | `TLS1_0`, `TLS1_1`, `TLS1_2` |
| `properties.networkAcls.defaultAction` | Network default action | `Allow`, `Deny` |
| `properties.encryption.keySource` | Encryption key source | `Microsoft.Storage`, `Microsoft.Keyvault` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Blob Services | `Microsoft.Storage/storageAccounts/blobServices` | Configure blob-specific settings |
| Containers | `Microsoft.Storage/storageAccounts/blobServices/containers` | Blob containers |
| File Services | `Microsoft.Storage/storageAccounts/fileServices` | File share settings |
| File Shares | `Microsoft.Storage/storageAccounts/fileServices/shares` | SMB/NFS file shares |
| Queue Services | `Microsoft.Storage/storageAccounts/queueServices` | Queue settings |
| Queues | `Microsoft.Storage/storageAccounts/queueServices/queues` | Storage queues |
| Table Services | `Microsoft.Storage/storageAccounts/tableServices` | Table settings |
| Tables | `Microsoft.Storage/storageAccounts/tableServices/tables` | Storage tables |

## References

- [Bicep resource reference (2025-01-01)](https://learn.microsoft.com/azure/templates/microsoft.storage/storageaccounts?pivots=deployment-language-bicep)
- [Storage account overview](https://learn.microsoft.com/azure/storage/common/storage-account-overview)
- [Azure naming rules — Storage](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftstorage)
- [Storage redundancy](https://learn.microsoft.com/azure/storage/common/storage-redundancy)
