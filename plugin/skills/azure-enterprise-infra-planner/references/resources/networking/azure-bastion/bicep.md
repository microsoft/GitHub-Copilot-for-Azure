## Required Properties (Bicep)

```bicep
resource bastion 'Microsoft.Network/bastionHosts@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'string'     // required — 'Developer', 'Basic', 'Standard', or 'Premium'
  }
  properties: {
    ipConfigurations: [           // required (except Developer SKU)
      {
        name: 'string'           // required
        properties: {
          subnet: {
            id: 'string'         // required — must be AzureBastionSubnet
          }
          publicIPAddress: {
            id: 'string'         // required
          }
        }
      }
    ]
  }
}
```
