# Identity and Access Security

## Security Principles

1. **Zero Trust** — Never trust, always verify
2. **Least Privilege** — Minimum required permissions

## Identity and Access Checklist

- [ ] Use managed identities (no credentials in code)
- [ ] Enable MFA for all users
- [ ] Apply least privilege RBAC
- [ ] Use Microsoft Entra ID for authentication
- [ ] Review access regularly

## Managed Identity

### Enable on Services

```bash
# App Service
az webapp identity assign --name APP -g RG

# Container Apps
az containerapp identity assign --name APP -g RG --system-assigned

# Function App
az functionapp identity assign --name APP -g RG
```

### Grant Access

```bash
# Grant Key Vault access
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee IDENTITY_PRINCIPAL_ID \
  --scope /subscriptions/SUB/resourceGroups/RG/providers/Microsoft.KeyVault/vaults/VAULT
```

## RBAC Best Practices

### Built-in Roles

| Role | Use When |
|------|----------|
| Reader | View-only access |
| Contributor | Full access except IAM |
| Key Vault Secrets User | Read secrets only |
| Storage Blob Data Reader | Read blobs only |

### Apply Least Privilege

```bash
# Grant minimal role at resource scope
az role assignment create \
  --role "Storage Blob Data Reader" \
  --assignee PRINCIPAL_ID \
  --scope /subscriptions/SUB/resourceGroups/RG/providers/Microsoft.Storage/storageAccounts/ACCOUNT
```
