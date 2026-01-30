---
name: azure-security
description: Azure Security Services - Key Vault, Managed Identity, RBAC, Entra ID, and Defender.
---

# Azure Security Services

## MCP Tools

**Key Vault**: `azure__keyvault` - `keyvault_list`, `keyvault_secret_list/get`, `keyvault_key_list`, `keyvault_certificate_list`

**RBAC**: `azure__role` - `role_assignment_list`, `role_definition_list`

**Setup:** `/azure:setup` or `/mcp`

## CLI Fallback

```bash
az keyvault list --output table
az keyvault secret list --vault-name VAULT --output table
az role assignment list --output table
az identity list --output table
```

## Principles

1. **Managed identities** - No credentials
2. **Least privilege** - Minimum permissions
3. **Key Vault** - Never hardcode secrets
4. **Private endpoints** - No public access

## Common Roles

| Role | Use |
|------|-----|
| Reader | Read-only |
| Contributor | Full (no IAM) |
| Key Vault Secrets User | Read secrets |
| Storage Blob Data Reader | Read blobs |

## References

[Key Vault](https://learn.microsoft.com/azure/key-vault/general/overview) · [Managed Identity](https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview) · [RBAC](https://learn.microsoft.com/azure/role-based-access-control/overview)
