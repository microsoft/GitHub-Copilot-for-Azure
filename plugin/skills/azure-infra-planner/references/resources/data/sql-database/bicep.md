## Required Properties (Bicep)

```bicep
resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01' = {
  name: 'string'       // required
  location: 'string'   // required — must match parent server location
  parent: sqlServer     // required — reference to Microsoft.Sql/servers
  sku: {
    name: 'string'     // recommended — defaults to Standard S0
    tier: 'string'     // recommended — see SKU Tiers table
  }
  properties: {}
}
```
