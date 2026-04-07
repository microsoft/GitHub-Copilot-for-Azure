# SQL Database - Bicep Patterns

## Basic Setup (Entra-Only Authentication)

**Recommended approach** — Uses Microsoft Entra ID authentication only. Required for subscriptions with policies enforcing Entra-only authentication.

```bicep
param principalId string
param principalName string

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${resourcePrefix}-sql-${uniqueHash}'
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'User'
      login: principalName
      sid: principalId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648  // 2 GB
  }
}

resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}
```

**Set Entra admin parameters:**

1. Get current user info:
```bash
az ad signed-in-user show --query "{id:id, name:displayName}" -o json
```

2. Set as azd environment variables:
```bash
PRINCIPAL_INFO=$(az ad signed-in-user show --query "{id:id, name:displayName}" -o json)
azd env set AZURE_PRINCIPAL_ID $(echo $PRINCIPAL_INFO | jq -r '.id')
azd env set AZURE_PRINCIPAL_NAME $(echo $PRINCIPAL_INFO | jq -r '.name')
```

> 💡 **Tip:** Set these variables immediately after `azd init` to avoid deployment failures. The Bicep `principalId` and `principalName` parameters will automatically use these environment variables.

## Serverless Configuration

```bicep
resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: 60  // minutes
    minCapacity: json('0.5')
  }
}
```

## Private Endpoint

```bicep
resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: '${sqlServer.name}-pe'
  location: location
  properties: {
    subnet: {
      id: subnet.id
    }
    privateLinkServiceConnections: [
      {
        name: '${sqlServer.name}-connection'
        properties: {
          privateLinkServiceId: sqlServer.id
          groupIds: ['sqlServer']
        }
      }
    ]
  }
}
```

## ⛔ MANDATORY: SQL Data-Plane Access via postprovision Hook

> **CRITICAL:** ARM/Bicep role assignments (`SQL DB Contributor`) only grant **control-plane** access. They do **not** grant the app **data-plane** access to the database. Without the T-SQL grant below, apps using `Authentication=Active Directory Default` will crash on startup with a login failure.
>
> **When you generate SQL + Managed Identity infrastructure you MUST also:**
> 1. Add a `postprovision` hook to `azure.yaml` that runs the SQL grant script
> 2. Generate the `scripts/grant-sql-access.sh` and `scripts/grant-sql-access.ps1` scripts

**azure.yaml hooks section (add or merge):**

```yaml
hooks:
  postprovision:
    posix:
      shell: sh
      run: ./scripts/grant-sql-access.sh
    windows:
      shell: pwsh
      run: ./scripts/grant-sql-access.ps1
```

**scripts/grant-sql-access.sh:**

```bash
#!/bin/bash
set -e
eval $(azd env get-values)

# SERVICE_WEB_NAME is used for App Service; use SERVICE_API_NAME for API services
APP_NAME=${SERVICE_WEB_NAME:-$SERVICE_API_NAME}

az sql db query \
  --server "$SQL_SERVER" \
  --database "$SQL_DATABASE" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --auth-mode ActiveDirectoryDefault \
  --queries "
    IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '$APP_NAME')
      CREATE USER [$APP_NAME] FROM EXTERNAL PROVIDER;

    IF NOT EXISTS (
      SELECT 1 FROM sys.database_role_members drm
      JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
      JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
      WHERE r.name = 'db_datareader' AND m.name = '$APP_NAME'
    )
      ALTER ROLE db_datareader ADD MEMBER [$APP_NAME];

    IF NOT EXISTS (
      SELECT 1 FROM sys.database_role_members drm
      JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
      JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
      WHERE r.name = 'db_datawriter' AND m.name = '$APP_NAME'
    )
      ALTER ROLE db_datawriter ADD MEMBER [$APP_NAME];

    IF NOT EXISTS (
      SELECT 1 FROM sys.database_role_members drm
      JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
      JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
      WHERE r.name = 'db_ddladmin' AND m.name = '$APP_NAME'
    )
      ALTER ROLE db_ddladmin ADD MEMBER [$APP_NAME];
  "
```

**scripts/grant-sql-access.ps1:**

```powershell
$ErrorActionPreference = 'Stop'
azd env get-values | ForEach-Object {
    $name, $value = $_.Split('=', 2)
    Set-Item "env:$name" $value.Trim('"')
}

# SERVICE_WEB_NAME is used for App Service; use SERVICE_API_NAME for API services
$AppName = if ($env:SERVICE_WEB_NAME) { $env:SERVICE_WEB_NAME } else { $env:SERVICE_API_NAME }

$SqlQuery = @"
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = '$AppName')
  CREATE USER [$AppName] FROM EXTERNAL PROVIDER;

IF NOT EXISTS (
  SELECT 1 FROM sys.database_role_members drm
  JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
  JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
  WHERE r.name = 'db_datareader' AND m.name = '$AppName'
)
  ALTER ROLE db_datareader ADD MEMBER [$AppName];

IF NOT EXISTS (
  SELECT 1 FROM sys.database_role_members drm
  JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
  JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
  WHERE r.name = 'db_datawriter' AND m.name = '$AppName'
)
  ALTER ROLE db_datawriter ADD MEMBER [$AppName];

IF NOT EXISTS (
  SELECT 1 FROM sys.database_role_members drm
  JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
  JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
  WHERE r.name = 'db_ddladmin' AND m.name = '$AppName'
)
  ALTER ROLE db_ddladmin ADD MEMBER [$AppName];
"@

az sql db query `
  --server $env:SQL_SERVER `
  --database $env:SQL_DATABASE `
  --resource-group $env:AZURE_RESOURCE_GROUP `
  --auth-mode ActiveDirectoryDefault `
  --queries $SqlQuery
```

> 💡 Make executable: `chmod +x scripts/*.sh`

> 💡 If the app also uses EF Core migrations, combine this with the migration hook — see [azure-deploy sql-managed-identity.md](../../../../azure-deploy/references/recipes/azd/sql-managed-identity.md).

## Legacy SQL Authentication (⛔ DO NOT USE)

> ❌ **DEPRECATED — DO NOT generate `administratorLogin` or `administratorLoginPassword` properties.**
> SQL admin authentication is disabled in subscriptions with Entra-only policies and violates Azure security best practices.
> Always use the Entra-only authentication pattern at the top of this file.
