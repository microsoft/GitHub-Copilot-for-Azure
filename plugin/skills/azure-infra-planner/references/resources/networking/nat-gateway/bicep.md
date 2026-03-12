## Required Properties (Bicep)

```bicep
resource natGateway 'Microsoft.Network/natGateways@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'Standard'   // required — only valid value
  }
  properties: {
    publicIpAddresses: [
      {
        id: 'string'   // recommended — resource ID of a Standard SKU Public IP
      }
    ]
  }
}
```
