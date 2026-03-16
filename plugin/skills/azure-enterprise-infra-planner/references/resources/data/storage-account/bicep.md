## Required Properties (Bicep)

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2025-01-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  kind: 'string'       // required — see Subtypes table
  sku: {
    name: 'string'     // required — see SKU Names table
  }
  properties: {
    accessTier: 'string'  // required when kind = 'BlobStorage'; optional otherwise
  }
}
```
