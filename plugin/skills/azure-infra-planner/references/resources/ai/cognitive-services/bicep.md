## Required Properties (Bicep)

```bicep
resource cognitiveAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: 'string'        // required, 2-64 chars
  location: 'string'    // required
  kind: 'string'        // required — see Subtypes table
  sku: {
    name: 'string'      // required — see SKU Names table
  }
  properties: {
    customSubDomainName: 'string'  // required for Entra ID auth, globally unique
  }
}
```
