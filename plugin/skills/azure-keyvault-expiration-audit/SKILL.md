---
name: azure-keyvault-expiration-audit
description: Audit Azure Key Vault for expired/expiring keys, secrets, and certificates. Use for compliance and preventing service disruptions.
---

# Key Vault Expiration Audit

Identify expired or expiring keys, secrets, and certificates before they cause service disruptions.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `keyvault_key_list/get` | List/get key details with expiration |
| `keyvault_secret_list/get` | List/get secret details with expiration |
| `keyvault_certificate_list/get` | List/get certificate details with expiration |

**Required**: `vault` (Key Vault name), **Optional**: `subscription`, `tenant`

## Workflow

1. **List resources** in target vault(s)
2. **Get details** with expiration metadata
3. **Analyze**: Compare dates against threshold (default 30 days)
4. **Report**: Organize by priority with recommendations

## Key Data Fields

`expiresOn` (null = no expiration - security risk), `enabled`, `createdOn/updatedOn`

## Priority Levels

| Priority | Days | Action |
|----------|------|--------|
| 🔴 Critical | < 0 (expired) | Rotate immediately |
| 🟠 High | 0-7 | Schedule within 24h |
| 🟡 Medium | 8-30 / no date | Plan within 1 week |
| 🟢 Low | > 30 | Regular monitoring |

## CLI Fallback

```bash
az keyvault secret list --vault-name VAULT
az keyvault key list --vault-name VAULT
az keyvault certificate list --vault-name VAULT
```

Use CLI when MCP times out or returns errors.