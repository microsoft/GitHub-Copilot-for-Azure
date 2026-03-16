## Required Properties (Bicep)

```bicep
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2025-04-15' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  kind: 'string'       // optional — defaults to 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'  // required — only valid value
    locations: [
      {
        locationName: 'string'        // required
        failoverPriority: int         // required (0 for primary)
        isZoneRedundant: bool         // optional
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'string'  // required
    }
  }
}
```
