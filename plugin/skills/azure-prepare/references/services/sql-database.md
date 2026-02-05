# Azure SQL Database

Data patterns and best practices for Azure SQL Database.

## When to Use

- Relational data with ACID requirements
- Complex queries and joins
- Existing SQL Server workloads
- Reporting and analytics
- Strong schema enforcement

## Bicep Resource Pattern

```bicep
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${resourcePrefix}-sql-${uniqueHash}'
  location: location
  properties: {
    administratorLogin: 'sqladmin'
    administratorLoginPassword: sqlAdminPassword
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

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| Key Vault | Store connection strings |
| Private Endpoint | Secure access (optional) |

## SKU Selection

| Tier | Use Case | Features |
|------|----------|----------|
| **Basic** | Dev/test, light workloads | 5 DTUs, 2GB |
| **Standard** | Production workloads | 10-3000 DTUs |
| **Premium** | High-performance | In-memory OLTP |
| **Serverless** | Variable workloads | Auto-pause, auto-scale |
| **Hyperscale** | Large databases | 100TB+, instant backup |

### Serverless Configuration

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

## Entra ID Authentication

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
  }
}
```

## Connection Patterns

### Node.js (mssql)

```javascript
const sql = require('mssql');

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  authentication: {
    type: 'azure-active-directory-default'
  },
  options: {
    encrypt: true
  }
};

const pool = await sql.connect(config);
```

### Python (pyodbc)

```python
import pyodbc
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://database.windows.net/.default")

conn = pyodbc.connect(
    f"Driver={{ODBC Driver 18 for SQL Server}};"
    f"Server={os.environ['SQL_SERVER']};"
    f"Database={os.environ['SQL_DATABASE']};"
    f"Authentication=ActiveDirectoryMsi"
)
```

### .NET (Entity Framework)

```csharp
services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions => sqlOptions.EnableRetryOnFailure()
    ));
```

## Environment Variables

| Variable | Value |
|----------|-------|
| `SQL_SERVER` | `{server}.database.windows.net` |
| `SQL_DATABASE` | Database name |
| `SQL_CONNECTION_STRING` | Full connection string (Key Vault) |

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

## Managed Identity Access

Grant app managed identity access:

```sql
CREATE USER [my-container-app] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [my-container-app];
ALTER ROLE db_datawriter ADD MEMBER [my-container-app];
```

## Security Features

| Feature | Description |
|---------|-------------|
| TDE | Transparent Data Encryption (enabled by default) |
| Always Encrypted | Client-side encryption for sensitive columns |
| Entra ID Auth | Microsoft Entra authentication (recommended) |

For comprehensive security guidance, see: [data-protection](../../_shared/security/data-protection.md), [identity-access](../../_shared/security/identity-access.md)
