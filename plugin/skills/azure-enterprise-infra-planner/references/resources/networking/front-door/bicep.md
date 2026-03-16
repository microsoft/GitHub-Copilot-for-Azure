## Required Properties (Bicep)

```bicep
resource frontDoor 'Microsoft.Cdn/profiles@2025-06-01' = {
  name: 'string'       // required
  location: 'global'   // required — must be 'global'
  sku: {
    name: 'string'     // required — 'Standard_AzureFrontDoor' or 'Premium_AzureFrontDoor'
  }
}
```
