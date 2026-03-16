## Required Properties (Bicep)

```bicep
resource apim 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  sku: {
    name: 'string'     // required — see SKU Names table
    capacity: int      // required (except Consumption, set to 0)
  }
  properties: {
    publisherEmail: 'string'  // required
    publisherName: 'string'   // required
  }
}
```
