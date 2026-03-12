## Required Properties (Bicep)

```bicep
resource appGw 'Microsoft.Network/applicationGateways@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    sku: {
      name: 'string'    // required — see SKU Names
      tier: 'string'    // required — must match SKU name pattern
      capacity: int     // required for v1; optional for v2 with autoscale
    }
    gatewayIPConfigurations: [
      {
        name: 'string'
        properties: {
          subnet: { id: 'string' }  // required — dedicated subnet
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'string'
        properties: {
          publicIPAddress: { id: 'string' }  // for public frontend
        }
      }
    ]
    frontendPorts: [
      {
        name: 'string'
        properties: { port: int }
      }
    ]
    backendAddressPools: [
      {
        name: 'string'
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'string'
        properties: {
          port: int
          protocol: 'string'  // 'Http' or 'Https'
        }
      }
    ]
    httpListeners: [
      {
        name: 'string'
        properties: {
          frontendIPConfiguration: { id: 'string' }
          frontendPort: { id: 'string' }
          protocol: 'string'  // 'Http' or 'Https'
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'string'
        properties: {
          ruleType: 'string'  // 'Basic' or 'PathBasedRouting'
          priority: int
          httpListener: { id: 'string' }
          backendAddressPool: { id: 'string' }
          backendHttpSettings: { id: 'string' }
        }
      }
    ]
  }
}
```
