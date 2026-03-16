## Required Properties (Bicep)

```bicep
resource mysqlServer 'Microsoft.DBforMySQL/flexibleServers@2023-12-30' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  sku: {
    name: 'string'     // required — see Common SKU Names table
    tier: 'string'     // required — 'Burstable', 'GeneralPurpose', or 'MemoryOptimized'
  }
  properties: {
    version: 'string'                  // recommended — MySQL version
    administratorLogin: 'string'       // required for new server (createMode: 'Default')
    administratorLoginPassword: 'string' // required for new server
    storage: {
      storageSizeGB: int               // recommended — 20 to 16384
    }
  }
}
```
