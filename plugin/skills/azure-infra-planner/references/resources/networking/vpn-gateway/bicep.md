## Required Properties (Bicep)

```bicep
resource vpnGw 'Microsoft.Network/virtualNetworkGateways@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    gatewayType: 'string'  // required — 'Vpn' or 'ExpressRoute'
    vpnType: 'string'      // required for Vpn — 'RouteBased' or 'PolicyBased'
    sku: {
      name: 'string'       // required — see SKU Names
      tier: 'string'       // required — must match sku.name
    }
    ipConfigurations: [
      {
        name: 'string'     // required
        properties: {
          subnet: { id: 'string' }          // required — must be GatewaySubnet
          publicIPAddress: { id: 'string' } // required
        }
      }
    ]
  }
}
```
