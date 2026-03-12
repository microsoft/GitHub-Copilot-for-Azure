## Required Properties (Bicep)

```bicep
resource lb 'Microsoft.Network/loadBalancers@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'string'     // required — 'Basic', 'Standard', or 'Gateway'
    tier: 'string'     // optional — 'Regional' (default) or 'Global'
  }
  properties: {
    frontendIPConfigurations: [
      {
        name: 'string'   // required
        properties: {
          // Public LB: publicIPAddress.id
          // Internal LB: subnet.id + privateIPAddress
        }
      }
    ]
  }
}
```
