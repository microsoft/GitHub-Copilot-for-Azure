# Bicep Patterns — Data Service Modules

Bicep module templates for database and cache services. Read when the prepare plan includes PostgreSQL or Redis.

For core patterns (file structure, skeleton, naming, tagging), see [bicep-patterns.md](bicep-patterns.md). For security defaults, see [bicep-patterns-security.md](bicep-patterns-security.md).

## PostgreSQL Flexible Server Module

```bicep
param pgName string
param location string
param tags object
param administratorLogin string
@secure()
param administratorLoginPassword string

// ⛔ Deploy phase: generate password ONCE, pass the SAME value to BOTH
// az deployment sub create --parameters administratorLoginPassword={value}
// AND az keyvault secret set --vault-name {kv} --name pg-password --value {value}
// in a SINGLE command block. Shell variables do NOT persist between tool calls.
param allowedExtensions string = 'uuid-ossp,pgcrypto,pg_trgm'

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: pgName
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: { storageSizeGB: 32 }
  }
}

// Allow Azure services to connect (Container Apps, App Service)
resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: pg
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// Allow PG extensions (uuid-ossp, pgcrypto, pg_trgm)
resource pgExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'azure.extensions'
  properties: { value: allowedExtensions, source: 'user-override' }
}
```

Wire connection string via Key Vault `secretRef` (Container Apps) or `@Microsoft.KeyVault()` (App Service).

## Redis Cache Module (Minimal)

```bicep
param redisName string
param location string
param tags object

resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: redisName
  location: location
  tags: tags
  properties: { sku: { name: 'Basic', family: 'C', capacity: 0 }, enableNonSslPort: false, minimumTlsVersion: '1.2' }
}
```

Store `redis.properties.hostName` + access key in Key Vault. Wire via `secretRef`/`@Microsoft.KeyVault()`.
