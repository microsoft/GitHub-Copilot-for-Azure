## Required Properties (Bicep)

```bicep
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  sku: {
    name: 'string'     // required — see Common SKU Names table
    tier: 'string'     // required — 'Burstable', 'GeneralPurpose', or 'MemoryOptimized'
  }
  properties: {
    version: 'string'                  // recommended — PostgreSQL major version
    administratorLogin: 'string'       // required for new server (createMode: 'Default')
    administratorLoginPassword: 'string' // required for new server
    storage: {
      storageSizeGB: int               // recommended — 32 to 32768
    }
  }
}
```
