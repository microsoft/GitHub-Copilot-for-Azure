---
name: azure-security
description: Azure Security Services including Key Vault, Managed Identity, RBAC, Entra ID, and Defender. Provides secrets management, credential-free authentication, role-based access control, and threat protection.
---

# Azure Security Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Key Vault | Secrets, keys, certificates | `azure_keyvault_*` | `az keyvault` |
| Managed Identity | Credential-free authentication | - | `az identity` |
| RBAC | Role-based access control | `azure_rbac_*` | `az role` |
| Entra ID | Identity and access management | - | `az ad` |
| Defender | Threat protection, security posture | - | `az security` |

## MCP Server (Preferred)

When Azure MCP is enabled:

### Key Vault
- `azure_keyvault_list` - List Key Vaults
- `azure_keyvault_secret_list` - List secrets in vault
- `azure_keyvault_secret_get` - Get secret value
- `azure_keyvault_key_list` - List keys
- `azure_keyvault_certificate_list` - List certificates

### RBAC
- `azure_rbac_role_assignment_list` - List role assignments
- `azure_rbac_role_definition_list` - List role definitions

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

- Key Vault best practices -> `services/keyvault.md`
- Managed identity patterns -> `services/managed-identity.md`
- RBAC configuration -> `services/rbac.md`
