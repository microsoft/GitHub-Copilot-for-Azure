# PostgreSQL Recipe — REFERENCE ONLY

Azure Database for PostgreSQL Flexible Server integration for Container Apps.

## When to Use

- Relational database for CRUD applications
- PostgreSQL-compatible workloads
- Applications requiring SQL queries, joins, transactions
- Django, Rails, Spring Data, Prisma backends

## Bicep — PostgreSQL Module

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param principalId string
param principalName string
param databaseName string = 'appdb'

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    storage: { storageSizeGB: 32 }
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// Entra ID administrator
resource admin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2023-12-01-preview' = {
  parent: postgres
  name: principalId
  properties: {
    principalType: 'ServicePrincipal'
    principalName: principalName
    tenantId: tenant().tenantId
  }
}

output fqdn string = postgres.properties.fullyQualifiedDomainName
output databaseName string = database.name
```

## Environment Variables

```bicep
env: [
  { name: 'PGHOST', value: postgres.outputs.fqdn }
  { name: 'PGDATABASE', value: postgres.outputs.databaseName }
  { name: 'PGPORT', value: '5432' }
  { name: 'PGSSLMODE', value: 'require' }
  { name: 'AZURE_CLIENT_ID', value: uami.outputs.clientId }
]
```

## Authentication

Use Entra ID (passwordless) authentication:

```python
# Python example
from azure.identity import DefaultAzureCredential
import psycopg2
import os

credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
token = credential.get_token("https://ossrdbms-aad.database.windows.net/.default")

conn = psycopg2.connect(
    host=os.environ["PGHOST"],
    database=os.environ["PGDATABASE"],
    user=os.environ["AZURE_CLIENT_ID"],
    password=token.token,
    sslmode="require",
)
```

## Node.js Connection

```javascript
const { DefaultAzureCredential } = require("@azure/identity");
const { Client } = require("pg");

const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});
const token = await credential.getToken(
  "https://ossrdbms-aad.database.windows.net/.default"
);

const client = new Client({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.AZURE_CLIENT_ID,
  password: token.token,
  ssl: { rejectUnauthorized: true },
  port: 5432,
});
```

## Firewall

For Container Apps with VNet integration, use private endpoints or service endpoints.
Without VNet, allow Azure services:

```bicep
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}
```

> ⚠️ **Always disable password auth** — set `passwordAuth: 'Disabled'`
> and use Entra ID authentication only.
