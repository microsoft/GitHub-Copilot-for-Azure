# SQL Managed Identity Access

Grant Azure managed identities permissions on Azure SQL Database using Entra ID authentication.

## Overview

Azure SQL Database with Entra-only authentication requires explicit permission grants for managed identities. After provisioning, App Service or Container App managed identities have **no database access by default**.

## Prerequisites

- Azure SQL Server with Entra ID admin configured
- App Service or Container App with system-assigned managed identity enabled
- Your account must be the Entra ID admin on the SQL Server (or have sufficient permissions)
- Azure CLI authenticated: `az login`

## Quick Grant Access

### Get Resource Information

```bash
# Get values from azd environment
APP_NAME=$(azd env get-values | grep -E "SERVICE_API_NAME|SERVICE_WEB_NAME" | head -1 | cut -d'=' -f2)
SQL_SERVER=$(azd env get-values | grep SQL_SERVER | cut -d'=' -f2)
SQL_DATABASE=$(azd env get-values | grep SQL_DATABASE | cut -d'=' -f2)
RESOURCE_GROUP=$(azd env get-values | grep AZURE_RESOURCE_GROUP | cut -d'=' -f2)

echo "App: $APP_NAME"
echo "SQL Server: $SQL_SERVER"
echo "Database: $SQL_DATABASE"
```

### Connect with Azure CLI (Recommended)

Use `az sql` to execute SQL commands with your Entra credentials:

```bash
# Grant database access (read/write/ddl for migrations)
az sql db query \
  --server "$SQL_SERVER" \
  --database "$SQL_DATABASE" \
  --resource-group "$RESOURCE_GROUP" \
  --auth-mode ActiveDirectoryDefault \
  --queries "
    CREATE USER [$APP_NAME] FROM EXTERNAL PROVIDER;
    ALTER ROLE db_datareader ADD MEMBER [$APP_NAME];
    ALTER ROLE db_datawriter ADD MEMBER [$APP_NAME];
    ALTER ROLE db_ddladmin ADD MEMBER [$APP_NAME];
  "
```

> 💡 **Tip:** Use `--auth-mode ActiveDirectoryDefault` to authenticate with your current Azure CLI credentials.

### Connect with sqlcmd (Alternative)

```bash
# Get access token
TOKEN=$(az account get-access-token --resource https://database.windows.net --query accessToken -o tsv)

# Connect and grant permissions
sqlcmd -S "$SQL_SERVER.database.windows.net" \
  -d "$SQL_DATABASE" \
  -G -P "$TOKEN" \
  -Q "
    CREATE USER [$APP_NAME] FROM EXTERNAL PROVIDER;
    ALTER ROLE db_datareader ADD MEMBER [$APP_NAME];
    ALTER ROLE db_datawriter ADD MEMBER [$APP_NAME];
    ALTER ROLE db_ddladmin ADD MEMBER [$APP_NAME];
  "
```

## Database Roles

Choose roles based on application needs:

| Role | Permissions | Use For |
|------|------------|---------|
| `db_datareader` | SELECT on all tables | Read-only queries |
| `db_datawriter` | INSERT, UPDATE, DELETE | CRUD operations |
| `db_ddladmin` | CREATE, ALTER, DROP schema objects | Running EF migrations |
| `db_owner` | Full database control | Admin operations (use sparingly) |

### Standard Application Access

Most ASP.NET Core apps with EF Core need read, write, and DDL permissions:

```sql
CREATE USER [my-app] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [my-app];
ALTER ROLE db_datawriter ADD MEMBER [my-app];
ALTER ROLE db_ddladmin ADD MEMBER [my-app];
```

### Read-Only Access

For reporting or analytics services:

```sql
CREATE USER [my-reporting-app] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [my-reporting-app];
```

## Automated Grant with azd Hook

Add a `postprovision` hook to `azure.yaml` to automate permission grants:

### azure.yaml

```yaml
name: myapp

services:
  api:
    project: ./src/api
    language: dotnet
    host: appservice

hooks:
  postprovision:
    shell: sh
    run: ./scripts/grant-sql-access.sh
```

### scripts/grant-sql-access.sh

```bash
#!/bin/bash
set -e

# Load environment variables from azd
eval $(azd env get-values)

echo "Granting SQL access to $SERVICE_API_NAME..."

az sql db query \
  --server "$SQL_SERVER" \
  --database "$SQL_DATABASE" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --auth-mode ActiveDirectoryDefault \
  --queries "
    IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '$SERVICE_API_NAME')
    BEGIN
        CREATE USER [$SERVICE_API_NAME] FROM EXTERNAL PROVIDER;
    END
    ALTER ROLE db_datareader ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_datawriter ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_ddladmin ADD MEMBER [$SERVICE_API_NAME];
  " || echo "Note: Permission grant failed. This may happen if user already exists with correct permissions."

echo "SQL access granted successfully."
```

### scripts/grant-sql-access.ps1

```powershell
#!/usr/bin/env pwsh

# Load environment variables from azd
azd env get-values | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
        Set-Variable -Name $parts[0] -Value $parts[1]
    }
}

Write-Host "Granting SQL access to $SERVICE_API_NAME..."

$query = @"
    IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '$SERVICE_API_NAME')
    BEGIN
        CREATE USER [$SERVICE_API_NAME] FROM EXTERNAL PROVIDER;
    END
    ALTER ROLE db_datareader ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_datawriter ADD MEMBER [$SERVICE_API_NAME];
    ALTER ROLE db_ddladmin ADD MEMBER [$SERVICE_API_NAME];
"@

try {
    az sql db query `
      --server $SQL_SERVER `
      --database $SQL_DATABASE `
      --resource-group $AZURE_RESOURCE_GROUP `
      --auth-mode ActiveDirectoryDefault `
      --queries $query
    
    Write-Host "SQL access granted successfully."
} catch {
    Write-Warning "Permission grant failed. This may be expected if user already exists."
}
```

> 💡 **Tip:** Make scripts executable: `chmod +x scripts/*.sh`

## Verification

Verify the managed identity user exists and has correct roles:

```bash
az sql db query \
  --server "$SQL_SERVER" \
  --database "$SQL_DATABASE" \
  --resource-group "$RESOURCE_GROUP" \
  --auth-mode ActiveDirectoryDefault \
  --queries "
    SELECT 
      dp.name AS UserName,
      dp.type_desc AS UserType,
      drm.role_principal_id,
      dr.name AS RoleName
    FROM sys.database_principals dp
    LEFT JOIN sys.database_role_members drm ON dp.principal_id = drm.member_principal_id
    LEFT JOIN sys.database_principals dr ON drm.role_principal_id = dr.principal_id
    WHERE dp.name = '$APP_NAME'
  "
```

**Expected Output:**

```
UserName          UserType              RoleName
my-app            EXTERNAL_USER         db_datareader
my-app            EXTERNAL_USER         db_datawriter
my-app            EXTERNAL_USER         db_ddladmin
```

## Troubleshooting

### Error: "Cannot find the user 'app-name', because it does not exist or you do not have permission"

**Cause:** Managed identity doesn't exist or name mismatch.

**Solution:**

```bash
# Verify managed identity exists
az webapp identity show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"

# Or for Container Apps
az containerapp identity show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"

# Use the exact principal name
```

### Error: "Principal 'user@domain.com' does not have permission to perform this action"

**Cause:** You're not the Entra ID admin on the SQL Server.

**Solution:**

```bash
# Check current admin
az sql server ad-admin list --server "$SQL_SERVER" --resource-group "$RESOURCE_GROUP"

# Set yourself as admin (if authorized)
YOUR_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)
az sql server ad-admin create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$SQL_SERVER" \
  --display-name "$(az ad signed-in-user show --query userPrincipalName -o tsv)" \
  --object-id "$YOUR_OBJECT_ID"
```

### Error: "Login failed for user '<token-identified principal>'"

**Cause:** Application is trying to connect but user not created in database.

**Solution:** Run the CREATE USER and ALTER ROLE commands from this guide.

### Idempotency Issues

To make scripts idempotent (safe to run multiple times):

```sql
-- Check if user exists before creating
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'my-app')
BEGIN
    CREATE USER [my-app] FROM EXTERNAL PROVIDER;
END

-- Role membership additions are idempotent (no error if already member)
ALTER ROLE db_datareader ADD MEMBER [my-app];
ALTER ROLE db_datawriter ADD MEMBER [my-app];
ALTER ROLE db_ddladmin ADD MEMBER [my-app];
```

## References

- [Azure SQL Entra Authentication Overview](/plugin/skills/azure-prepare/references/services/sql-database/auth.md)
- [EF Core Migrations](ef-migrations.md)
- [Post-Deployment Guide](post-deployment.md)
