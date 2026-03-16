# Key Vault

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.KeyVault/vaults` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `kv` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Key Vault does not use `kind`. All vaults share the same resource type.

## SKU Names

Exact `sku` values for Bicep — both `name` and `family` are required:

| SKU Name | SKU Family | Description |
|----------|------------|-------------|
| `standard` | `A` | Software-protected keys, secrets, and certificates |
| `premium` | `A` | Adds HSM-protected keys |

> **Note:** `sku.family` must always be `'A'` — it is the only accepted value.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 24 |
| Allowed Characters | Alphanumerics and hyphens. Must start with a letter, end with a letter or digit. No consecutive hyphens. |
| Scope | Global (must be globally unique as DNS name) |
| Pattern | `kv-{workload}-{env}-{instance}` |
| Example | `kv-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.enableSoftDelete` | Soft delete protection | `true` (default, cannot be disabled once enabled) |
| `properties.enablePurgeProtection` | Prevent purge during retention | `true`, `false` (cannot be disabled once enabled) |
| `properties.enableRbacAuthorization` | Use RBAC instead of access policies | `true`, `false` |
| `properties.softDeleteRetentionInDays` | Soft delete retention period | `7` to `90` (default: `90`) |
| `properties.enabledForDeployment` | Allow VMs to retrieve certificates | `true`, `false` |
| `properties.enabledForDiskEncryption` | Allow Azure Disk Encryption | `true`, `false` |
| `properties.enabledForTemplateDeployment` | Allow ARM to retrieve secrets | `true`, `false` |
| `properties.publicNetworkAccess` | Public network access | `Disabled`, `Enabled` |
| `properties.networkAcls.defaultAction` | Default network rule | `Allow`, `Deny` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Secrets | `Microsoft.KeyVault/vaults/secrets` | Store secret values |
| Keys | `Microsoft.KeyVault/vaults/keys` | Cryptographic keys |
| Access Policies | `Microsoft.KeyVault/vaults/accessPolicies` | Vault-level access (legacy; prefer RBAC) |
| Private Endpoints | `Microsoft.KeyVault/vaults/privateEndpointConnections` | Private link connections |

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.keyvault/vaults?pivots=deployment-language-bicep)
- [Key Vault overview](https://learn.microsoft.com/azure/key-vault/general/overview)
- [Azure naming rules — Key Vault](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftkeyvault)
- [Key Vault soft-delete](https://learn.microsoft.com/azure/key-vault/general/soft-delete-overview)
