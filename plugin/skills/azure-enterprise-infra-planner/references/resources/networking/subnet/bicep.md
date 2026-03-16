## Required Properties (Bicep)

```bicep
resource subnet 'Microsoft.Network/virtualNetworks/subnets@2024-07-01' = {
  name: 'string'       // required
  parent: vnet          // required — reference to VNet
  properties: {
    addressPrefix: 'string'  // required — e.g., '10.0.1.0/24'
  }
}
```
