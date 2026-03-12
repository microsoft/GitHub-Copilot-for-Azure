## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Storage Account (CMK)** | Must have `enableSoftDelete: true` AND `enablePurgeProtection: true`. |
| **Storage Account (CMK at creation)** | Storage must use user-assigned managed identity — system-assigned only works for existing accounts. |
| **SQL Server (TDE)** | Must enable `enablePurgeProtection`. Key Vault and SQL Server must be in the same Azure AD tenant. |
| **AKS (secrets)** | Use `enableRbacAuthorization: true` with Azure RBAC for secrets access. AKS needs `azureKeyvaultSecretsProvider` addon. |
| **Disk Encryption** | Must set `enabledForDiskEncryption: true`. Premium SKU required for HSM-protected keys. |
| **Private Endpoint** | Set `publicNetworkAccess: 'Disabled'` and `networkAcls.defaultAction: 'Deny'` when using private endpoints. |
| **CMK Firewall** | When any Azure service uses CMK from Key Vault, the Key Vault firewall must enable "Allow trusted Microsoft services to bypass this firewall" — unless using private endpoints to Key Vault. |
| **CMK Key Type** | Key must be RSA or RSA-HSM, 2048/3072/4096-bit. Other key types are not supported for customer-managed keys. |
| **CMK Cross-Tenant** | Key Vault and consuming service must be in the same Azure AD tenant. Cross-tenant CMK requires separate configuration. |
