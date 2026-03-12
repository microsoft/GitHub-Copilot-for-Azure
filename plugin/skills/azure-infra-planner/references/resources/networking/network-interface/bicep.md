## Required Properties (Bicep)

```bicep
resource nic 'Microsoft.Network/networkInterfaces@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    ipConfigurations: [
      {
        name: 'string'           // required
        properties: {
          subnet: {
            id: 'string'         // required — resource ID of the subnet
          }
          privateIPAllocationMethod: 'string'  // required — 'Dynamic' or 'Static'
        }
      }
    ]
  }
}
```
