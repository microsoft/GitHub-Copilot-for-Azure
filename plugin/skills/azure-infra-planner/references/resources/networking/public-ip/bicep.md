## Required Properties (Bicep)

```bicep
resource pip 'Microsoft.Network/publicIPAddresses@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'string'     // required — 'Basic', 'Standard', or 'StandardV2'
    tier: 'string'     // optional — 'Regional' (default) or 'Global'
  }
  properties: {
    publicIPAllocationMethod: 'string'  // required
    publicIPAddressVersion: 'string'    // optional — default 'IPv4'
  }
}
```
