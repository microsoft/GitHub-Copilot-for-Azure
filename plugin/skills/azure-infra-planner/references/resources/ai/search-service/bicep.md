## Required Properties (Bicep)

```bicep
resource searchService 'Microsoft.Search/searchServices@2025-05-01' = {
  name: 'string'        // required, 2-60 chars, globally unique
  location: 'string'    // required
  sku: {
    name: 'string'      // required — see SKU Names table
  }
  properties: {
    replicaCount: int    // optional, default 1
    partitionCount: int  // optional, default 1
  }
}
```
