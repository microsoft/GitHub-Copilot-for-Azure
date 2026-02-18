# SQL Database - Entra ID Authentication

## Entra ID Admin Configuration (User)

**Recommended for development** — Uses signed-in user as admin.

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
```

**Get signed-in user info:**
```bash
az ad signed-in-user show --query "{id:id, name:displayName}" -o json
```

## Entra ID Admin Configuration (Group)

**Recommended for production** — Uses Entra group for admin access.

```bicep
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${resourcePrefix}-sql-${uniqueHash}'
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Group'
      login: 'SQL Admins'
      sid: entraGroupObjectId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
  }
}
```

## Managed Identity Access

Grant app managed identity access via SQL:

```sql
CREATE USER [my-container-app] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [my-container-app];
ALTER ROLE db_datawriter ADD MEMBER [my-container-app];
```

## Common Database Roles

| Role | Permissions |
|------|-------------|
| `db_datareader` | Read all tables |
| `db_datawriter` | Insert, update, delete |
| `db_ddladmin` | Create/modify schema |
| `db_owner` | Full access |

## Connection Strings

### Entra ID Authentication (Recommended)

```
Server=tcp:{server}.database.windows.net,1433;Database={database};Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;
```

**Required for .NET applications:**
- `Microsoft.Data.SqlClient` (v5.1.0+)
- `Azure.Identity` (for local development)

### Legacy SQL Authentication

```
Server=tcp:{server}.database.windows.net,1433;Database={database};User ID={username};Password={password};Encrypt=True;
```

> ⚠️ **Warning**: This will fail in subscriptions requiring Entra-only authentication.
