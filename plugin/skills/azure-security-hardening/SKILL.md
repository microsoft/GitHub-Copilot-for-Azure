---
name: azure-security-hardening
description: Secure Azure resources following Zero Trust principles. Covers managed identities, RBAC best practices, Key Vault security, network security with private endpoints and NSGs, encryption, and Microsoft Defender for Cloud configuration.
---

# Securing Azure Resources

## Security Principles

1. **Zero Trust** - Never trust, always verify
2. **Least Privilege** - Minimum required permissions
3. **Defense in Depth** - Multiple security layers
4. **Encryption Everywhere** - At rest and in transit

## Essential Security Checklist

### Identity and Access
- [ ] Use managed identities (no credentials)
- [ ] Enable MFA for all users
- [ ] Apply least privilege RBAC
- [ ] Use Azure AD for authentication
- [ ] Review access regularly

### Network Security
- [ ] Use private endpoints for PaaS
- [ ] Configure NSGs on all subnets
- [ ] Disable public endpoints where possible
- [ ] Enable DDoS protection
- [ ] Use Azure Firewall or NVA

### Data Protection
- [ ] Enable encryption at rest (default)
- [ ] Use TLS 1.2+ for transit
- [ ] Store secrets in Key Vault
- [ ] Enable soft delete for Key Vault
- [ ] Use customer-managed keys (CMK) for sensitive data

### Monitoring
- [ ] Enable Microsoft Defender for Cloud
- [ ] Configure diagnostic logging
- [ ] Set up security alerts
- [ ] Enable audit logging

## Key Vault Security

```bash
# Enable soft delete and purge protection
az keyvault update \
  --name VAULT -g RG \
  --enable-soft-delete true \
  --enable-purge-protection true

# Enable RBAC permission model
az keyvault update \
  --name VAULT -g RG \
  --enable-rbac-authorization true
```

## Network Security

### Private Endpoints

```bash
# Create private endpoint for storage
az network private-endpoint create \
  --name myEndpoint -g RG \
  --vnet-name VNET --subnet SUBNET \
  --private-connection-resource-id STORAGE_ID \
  --group-id blob \
  --connection-name myConnection
```

### NSG Rules

```bash
# Deny all inbound by default
# Allow only required traffic
az network nsg rule create \
  --nsg-name NSG -g RG \
  --name AllowHTTPS \
  --priority 100 \
  --destination-port-ranges 443 \
  --access Allow
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

## Microsoft Defender for Cloud

```bash
# Enable Defender plans
az security pricing create \
  --name VirtualMachines \
  --tier Standard
```

## Security by Service

| Service | Key Security Features |
|---------|----------------------|
| SQL Database | TDE, Always Encrypted, AAD auth |
| Cosmos DB | Encryption, firewall, private endpoint |
| Storage | Encryption, SAS tokens, private endpoint |
| AKS | Workload identity, network policy, private cluster |
| Key Vault | RBAC, soft delete, purge protection |

## Security Assessment

Use Azure Security Center for:
- Security score
- Recommendations
- Compliance assessment
- Threat detection
