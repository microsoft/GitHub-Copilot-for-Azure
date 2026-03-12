## Required Properties (Bicep)

```bicep
resource redisCache 'Microsoft.Cache/redis@2024-11-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  properties: {
    sku: {
      name: 'string'     // required — 'Basic', 'Standard', or 'Premium'
      family: 'string'   // required — 'C' (Basic/Standard) or 'P' (Premium)
      capacity: int      // required — see Capacity tables
    }
  }
}
```
