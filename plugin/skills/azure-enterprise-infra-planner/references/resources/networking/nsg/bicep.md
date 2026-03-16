## Required Properties (Bicep)

```bicep
resource nsg 'Microsoft.Network/networkSecurityGroups@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    securityRules: [    // optional — can also use child resources
      {
        name: 'string'           // required
        properties: {
          priority: int          // required — 100–4096, unique per direction
          direction: 'string'    // required
          access: 'string'       // required
          protocol: 'string'     // required
          sourceAddressPrefix: 'string'       // required (or sourceAddressPrefixes)
          destinationAddressPrefix: 'string'  // required (or destinationAddressPrefixes)
          sourcePortRange: 'string'           // required (or sourcePortRanges)
          destinationPortRange: 'string'      // required (or destinationPortRanges)
        }
      }
    ]
  }
}
```
