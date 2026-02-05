# Data Protection

## Security Principles

1. **Encryption Everywhere** — At rest and in transit
2. **Defense in Depth** — Multiple security layers

## Data Protection Checklist

- [ ] Enable encryption at rest (default for most Azure services)
- [ ] Use TLS 1.2+ for transit
- [ ] Store secrets in Key Vault
- [ ] Enable soft delete for Key Vault
- [ ] Use customer-managed keys (CMK) for sensitive data

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

## Best Practices

1. **Never store secrets in code** — Use Key Vault or managed identity
2. **Rotate secrets regularly** — Set expiration dates and automate rotation
3. **Enable soft delete** — Protect against accidental deletion
4. **Enable purge protection** — Prevent permanent deletion during retention
5. **Use RBAC for Key Vault** — Prefer over access policies
6. **Customer-managed keys** — For sensitive data requiring key control
