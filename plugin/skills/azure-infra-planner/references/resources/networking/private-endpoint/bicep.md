## Required Properties (Bicep)

```bicep
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    subnet: {
      id: 'string'     // required — resource ID of the subnet
    }
    privateLinkServiceConnections: [
      {
        name: 'string'                   // required
        properties: {
          privateLinkServiceId: 'string'  // required — resource ID of the target resource
          groupIds: [
            'string'                      // required — sub-resource group (e.g., 'blob', 'vault', 'sqlServer')
          ]
        }
      }
    ]
  }
}
```
