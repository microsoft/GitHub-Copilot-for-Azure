## Required Properties (Bicep)

```bicep
resource routeTable 'Microsoft.Network/routeTables@2024-07-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    routes: [           // optional — can also use child resources
      {
        name: 'string'           // required
        properties: {
          addressPrefix: 'string'     // required — destination CIDR
          nextHopType: 'string'       // required
          nextHopIpAddress: 'string'  // required when nextHopType is 'VirtualAppliance'
        }
      }
    ]
  }
}
```
