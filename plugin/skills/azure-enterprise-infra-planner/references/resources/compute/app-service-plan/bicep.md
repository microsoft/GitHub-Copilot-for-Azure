## Required Properties (Bicep)

```bicep
resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: 'string'       // required
  location: 'string'   // required
  kind: 'string'       // recommended — 'linux', 'windows', 'elastic', 'functionapp'
  sku: {
    name: 'string'     // required — see SKU Names
    tier: 'string'     // optional — inferred from sku.name
    capacity: int      // optional — number of instances
  }
  properties: {
    reserved: bool     // required for Linux — set to true
  }
}
```
