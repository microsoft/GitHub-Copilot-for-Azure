---
name: azure-security-hardening
description: Secure Azure resources with Zero Trust, managed identities, RBAC, Key Vault, network security, and Microsoft Defender.
---

# Azure Security Hardening

Zero Trust, managed identities, RBAC, Key Vault, network security.

## Principles

1. **Zero Trust** - Never trust, always verify
2. **Least Privilege** - Minimum required permissions
3. **Encryption** - At rest and in transit

## Essential Checklist

**Identity**: Managed identities, MFA, least-privilege RBAC, Entra ID auth
**Network**: Private endpoints, NSGs, disable public endpoints
**Data**: TLS 1.2+, Key Vault for secrets, soft delete enabled

## Key Vault Security

```bash
az keyvault update --name VAULT -g RG \
  --enable-soft-delete true --enable-purge-protection true \
  --enable-rbac-authorization true
```

## Private Endpoints

```bash
az network private-endpoint create \
  --name myEndpoint -g RG --vnet-name VNET --subnet SUBNET \
  --private-connection-resource-id STORAGE_ID --group-id blob
```

## Managed Identity

```bash
# Enable
az webapp identity assign --name APP -g RG
az containerapp identity assign --name APP -g RG --system-assigned

# Grant access
az role assignment create --role "Key Vault Secrets User" \
  --assignee IDENTITY_PRINCIPAL_ID --scope VAULT_RESOURCE_ID
```

## Built-in Roles

| Role | Use |
|------|-----|
| Reader | View-only |
| Key Vault Secrets User | Read secrets |
| Storage Blob Data Reader | Read blobs |
