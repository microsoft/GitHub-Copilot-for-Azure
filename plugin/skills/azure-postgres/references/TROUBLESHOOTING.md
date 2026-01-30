# Troubleshooting Azure PostgreSQL Entra ID Authentication

This guide helps diagnose and resolve common authentication issues when connecting to Azure Database for PostgreSQL using Microsoft Entra ID.

## Quick Diagnostic Checklist

Run through this checklist when authentication fails:

| Check | Command | Expected |
|-------|---------|----------|
| Role exists in database | `SELECT * FROM pgaadauth_list_principals(false);` | Your role appears in list |
| Token is fresh | Check timestamp from `az account get-access-token` | `expiresOn` is in the future |
| Username format correct | Compare with role name in database | Exact match (case-sensitive) |
| Network connectivity | `nslookup login.microsoftonline.com` | Resolves to IP address |
| DNS for Graph API | `nslookup graph.microsoft.com` | Resolves to IP address |
| Entra admin exists | `az postgres flexible-server microsoft-entra-admin list` | At least one admin |

## Common Errors and Solutions

### Error: `role "user@domain.com" does not exist`

**Cause:** The PostgreSQL role hasn't been created for this Entra identity.

**Solution:**

1. Connect as an Entra admin:
```bash
export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
psql "host=<server>.postgres.database.azure.com user=admin@domain.com dbname=postgres sslmode=require"
```

2. Create the role:
```sql
-- By name (for users)
SELECT * FROM pgaadauth_create_principal('user@domain.com', false, false);

-- By object ID (for managed identities/service principals)
SELECT * FROM pgaadauth_create_principal_with_oid('my-identity', '<object-id>', 'service', false, false);
```

---

### Error: `password authentication failed for user "user@domain.com"`

**Cause:** Token is expired, invalid, or wrong format.

**Solution:**

1. Get a fresh token:
```bash
# Bash
export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)

# PowerShell
$env:PGPASSWORD = az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv
```

2. Verify token validity:
```bash
az account get-access-token --resource-type oss-rdbms --query expiresOn -o tsv
```

3. Ensure you're logged in as the correct user:
```bash
az account show --query user.name -o tsv
```

---

### Error: `FATAL: password authentication failed` (no username in error)

**Cause:** Username format is incorrect or doesn't match the database role.

**Solution:**

1. Check the exact role name in the database:
```sql
SELECT * FROM pgaadauth_list_principals(false);
```

2. Use the **exact** role name (case-sensitive) in your connection:
```bash
# If role is "Developer@Company.com", use exactly that
psql "host=<server>.postgres.database.azure.com user=Developer@Company.com dbname=mydb sslmode=require"
```

3. For guest users, use the full UPN with `#EXT#`:
```bash
psql "host=<server>.postgres.database.azure.com user=guest_user_example.com#EXT#@tenant.onmicrosoft.com dbname=mydb sslmode=require"
```

---

### Error: `could not connect to server: Connection timed out`

**Cause:** Network/firewall blocking connection or incorrect server name.

**Solution:**

1. Verify server FQDN:
```bash
az postgres flexible-server show --resource-group <rg> --name <server> --query fullyQualifiedDomainName -o tsv
```

2. Check firewall rules:
```bash
az postgres flexible-server firewall-rule list --resource-group <rg> --name <server>
```

3. For private endpoint, verify NSG allows outbound to `AzureActiveDirectory` service tag

4. Verify DNS resolution for server and `login.microsoftonline.com`

---

### Error: `SSL SYSCALL error: Connection reset by peer`

**Cause:** TLS/SSL connection issue, often network-related.

**Solution:**

1. Ensure `sslmode=require` is in connection string
2. Check if proxy/firewall is intercepting TLS traffic
3. For private endpoint, verify route table has `AzureActiveDirectory` → `Internet`

---

### Error: Token acquisition fails

**Cause:** Not logged into Azure CLI or wrong account.

**Solution:**

1. Log in to Azure:
```bash
az login
```

2. Select the correct subscription:
```bash
az account set --subscription <subscription-id>
```

3. Verify you have access:
```bash
az account show
```

4. For service principal authentication:
```bash
az login --service-principal -u <client-id> -p <client-secret> --tenant <tenant-id>
```

---

### Error: `Cannot validate Microsoft Entra ID user because its name isn't unique`

**Cause:** Multiple objects in Azure AD have the same display name.

**Solution:**

Use `pgaadauth_create_principal_with_oid` instead:

```sql
-- Get the object ID first
-- az ad user show --id user@domain.com --query id -o tsv

SELECT * FROM pgaadauth_create_principal_with_oid('unique-role-name', '<object-id>', 'user', false, false);
```

---

### Error: Group member can't connect (group sync enabled)

**Cause:** Group sync hasn't run yet (runs every 30 minutes).

**Solution:**

1. Manually trigger sync:
```sql
SELECT * FROM pgaadauth_sync_roles_for_group_members();
```

2. Wait a few seconds and check roles:
```sql
SELECT * FROM pgaadauth_list_principals(false);
```

3. Verify the user is actually in the Azure AD group:
```bash
az ad group member list --group "Group Name" --query "[].userPrincipalName" -o tsv
```

---

### Error: Managed identity can't connect from Azure-hosted app

**Cause:** Application not using Azure Identity SDK correctly.

**Solution:**

1. Verify managed identity is enabled:
```bash
az containerapp identity show --name <app> --resource-group <rg>  # Container Apps
az webapp identity show --name <app> --resource-group <rg>        # App Service
```

2. Ensure role name matches exactly what was created in PostgreSQL

3. Verify managed identity object ID matches database:
```bash
az identity show --name <identity> --resource-group <rg> --query principalId -o tsv
```

---

## Diagnostic Commands Reference

| Task | Command |
|------|---------|
| Check Entra admin | `az postgres flexible-server microsoft-entra-admin list --resource-group <rg> --server-name <server>` |
| List Entra roles | `SELECT * FROM pgaadauth_list_principals(false);` |
| List all roles | `\du` in psql |
| Verify token | `az account get-access-token --resource-type oss-rdbms` |
| DNS check | `nslookup <server>.postgres.database.azure.com` |
| TCP check | `nc -zv <server>.postgres.database.azure.com 5432` |
| Group sync setting | `az postgres flexible-server parameter show --resource-group <rg> --server-name <server> --name pgaadauth.enable_group_sync` |

## Still Having Issues?

Enable diagnostic logging on the server, check Azure Monitor logs, verify RBAC permissions, or contact support with diagnostic output.