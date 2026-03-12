# User Assigned Managed Identity

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.ManagedIdentity/userAssignedIdentities` |
| Bicep API Version | `2024-11-30` |
| CAF Prefix | `id` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

User Assigned Managed Identity does not use `kind`.

## SKU Names

User Assigned Managed Identity does not use a `sku` block.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 128 |
| Allowed Characters | Alphanumerics, hyphens, and underscores. Must start with a letter or number. |
| Scope | Resource group |
| Pattern | `id-{workload}-{env}-{instance}` |
| Example | `id-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `location` | Azure region | Region string |
| `tags` | Resource tags | Object of key/value pairs |

> **Note:** User Assigned Managed Identity has no `properties` block. It is a simple resource that produces a `principalId`, `clientId`, and `tenantId` as read-only outputs.

### Read-Only Outputs

| Output | Description |
|--------|-------------|
| `properties.principalId` | Object ID of the service principal in Microsoft Entra ID |
| `properties.clientId` | Application (client) ID of the service principal |
| `properties.tenantId` | Microsoft Entra tenant ID |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Federated Identity Credentials | `Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials` | Workload identity federation (GitHub Actions, Kubernetes OIDC, etc.) |

## References

- [Bicep resource reference (2024-11-30)](https://learn.microsoft.com/azure/templates/microsoft.managedidentity/userassignedidentities?pivots=deployment-language-bicep)
- [Managed identities overview](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview)
- [Azure naming rules — Managed Identity](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftmanagedidentity)
- [Workload identity federation](https://learn.microsoft.com/entra/workload-id/workload-identity-federation)
