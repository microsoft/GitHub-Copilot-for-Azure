## Required Properties (Bicep)

```bicep
resource firewall 'Microsoft.Network/azureFirewalls@2024-07-01' = {
  name: 'string'       // required, 1–56 chars
  location: 'string'   // required
  properties: {
    sku: {
      name: 'string'   // required — 'AZFW_VNet' or 'AZFW_Hub'
      tier: 'string'   // required — 'Basic', 'Standard', or 'Premium'
    }
    ipConfigurations: [           // required for AZFW_VNet
      {
        name: 'string'           // required
        properties: {
          subnet: { id: 'string' }          // required — must be AzureFirewallSubnet
          publicIPAddress: { id: 'string' } // required
        }
      }
    ]
  }
}
```
