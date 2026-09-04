# PostgreSQL Recipe

Use Azure Database for PostgreSQL Flexible Server for relational workloads. Use Microsoft
Entra authentication, a separate deployment administrator, and a non-admin app role.

## Infrastructure

```bicep
param name string
param location string = resourceGroup().location
param adminPrincipalId string
param adminPrincipalName string
param virtualNetworkName string
param postgresSubnetPrefix string = '10.0.2.0/24'

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' existing = {
  name: virtualNetworkName
}
resource postgresSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: vnet
  name: 'postgres'
  properties: {
    addressPrefix: postgresSubnetPrefix
    delegations: [
      {
        name: 'postgres'
        properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' }
      }
    ]
  }
}
resource privateDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'private.postgres.database.azure.com'
  location: 'global'
}
resource privateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: privateDns
  name: '${name}-vnet-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: name
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    storage: { storageSizeGB: 32 }
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: postgresSubnet.id
      privateDnsZoneArmResourceId: privateDns.id
      publicNetworkAccess: 'Disabled'
    }
  }
  dependsOn: [privateDnsLink]
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'appdb'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource admin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: postgres
  name: adminPrincipalId
  properties: {
    principalType: 'ServicePrincipal'
    principalName: adminPrincipalName
    tenantId: tenant().tenantId
  }
}

output fqdn string = postgres.properties.fullyQualifiedDomainName
```

## Application Configuration

Set `PGHOST`, `PGDATABASE=appdb`, `PGPORT=5432`, `PGSSLMODE=require`,
`PGUSER=<appPrincipalName>`, and `AZURE_CLIENT_ID=<app-UAMI-client-id>`.

The administrator must create a non-admin role mapped to the app UAMI. Run this once from
a deployment hook authenticated as `adminPrincipalId`:

```sql
SELECT * FROM pg_catalog.pgaadauth_create_principal_with_oid(
  '<app-principal-name>', '<app-principal-object-id>', 'service', false, false
);
GRANT CONNECT ON DATABASE appdb TO "<app-principal-name>";
GRANT USAGE ON SCHEMA public TO "<app-principal-name>";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO "<app-principal-name>";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public
  TO "<app-principal-name>";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "<app-principal-name>";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "<app-principal-name>";
```

Run the `ALTER DEFAULT PRIVILEGES` statements as the role that owns future migration objects.

## Language Guides

| Language | Guide |
|---|---|
| C# | [source/dotnet.md](source/dotnet.md) |
| Python | [source/python.md](source/python.md) |
| Node.js/TypeScript | [source/nodejs.md](source/nodejs.md) |
| Go | [source/go.md](source/go.md) |
| Java | [source/java.md](source/java.md) |

> ⚠️ Keep `adminPrincipalId` separate from `appPrincipalId`; the application identity must
> not be a PostgreSQL administrator. Pass the VNet used by the Container Apps environment;
> the recipe creates a separate delegated database subnet and disables public access.
>
> **Source:** [Manage Microsoft Entra roles in PostgreSQL](https://learn.microsoft.com/azure/postgresql/security/security-manage-entra-users)

See [eval/summary.md](eval/summary.md) for static coverage.
