---
name: azure-security
description: Azure Security Services including Key Vault, Managed Identity, RBAC, Entra ID, and Defender. Provides secrets management, credential-free authentication, role-based access control, and threat protection.
---

# Azure Security Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Key Vault | Secrets, keys, certificates | `azure__keyvault` | `az keyvault` |
| Managed Identity | Credential-free authentication | - | `az identity` |
| RBAC | Role-based access control | `azure__role` | `az role` |
| Entra ID | Identity and access management | - | `az ad` |
| Defender | Threat protection, security posture | - | `az security` |

## MCP Server (Preferred)

When Azure MCP is enabled:

### Key Vault
- `azure__keyvault` with command `keyvault_list` - List Key Vaults
- `azure__keyvault` with command `keyvault_secret_list` - List secrets in vault
- `azure__keyvault` with command `keyvault_secret_get` - Get secret value
- `azure__keyvault` with command `keyvault_key_list` - List keys
- `azure__keyvault` with command `keyvault_certificate_list` - List certificates

### RBAC
- `azure__role` with command `role_assignment_list` - List role assignments
- `azure__role` with command `role_definition_list` - List role definitions

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

## CLI Fallback

```bash
# Key Vault
az keyvault list --output table
az keyvault secret list --vault-name VAULT --output table
az keyvault secret show --vault-name VAULT --name SECRET

# RBAC
az role assignment list --output table
az role definition list --output table

# Managed Identity
az identity list --output table
```

## Key Security Principles

1. **Use managed identities** - No credentials to manage
2. **Apply least privilege** - Minimum required permissions
3. **Enable Key Vault** - Never hardcode secrets
4. **Use private endpoints** - No public internet access
5. **Enable auditing** - Log all access

## Common RBAC Roles

| Role | Permissions |
|------|-------------|
| Owner | Full access + assign roles |
| Contributor | Full access, no role assignment |
| Reader | Read-only |
| Key Vault Secrets User | Read secrets only |
| Storage Blob Data Reader | Read blobs only |

## Service Details

For deep documentation on specific services:

- Key Vault best practices -> [Key Vault documentation](https://learn.microsoft.com/azure/key-vault/general/overview)
- Managed identity patterns -> [Managed identities documentation](https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview)
- RBAC configuration -> `azure-role-selector` skill or [Azure RBAC documentation](https://learn.microsoft.com/azure/role-based-access-control/overview)

## Azure SDKs

For building applications that interact with Azure security services programmatically, Azure provides SDK packages in multiple languages (.NET, Java, JavaScript, Python, Go, Rust). See [SDK Usage Guide](references/sdk-usage.md) for package names, installation commands, and quick start examples.
