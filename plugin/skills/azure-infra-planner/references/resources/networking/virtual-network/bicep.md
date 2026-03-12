## Required Properties (Bicep)

```bicep
resource vnet 'Microsoft.Network/virtualNetworks@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    addressSpace: {
      addressPrefixes: [
        'string'        // required — e.g., '10.0.0.0/16'
      ]
    }
  }
}
```
