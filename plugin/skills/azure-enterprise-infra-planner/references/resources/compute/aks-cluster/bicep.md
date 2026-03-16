## Required Properties (Bicep)

```bicep
resource aksCluster 'Microsoft.ContainerService/managedClusters@2025-05-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'string'     // required — 'Base' or 'Automatic'
    tier: 'string'     // required — 'Free', 'Standard', or 'Premium'
  }
  identity: {
    type: 'SystemAssigned'  // recommended
  }
  properties: {
    dnsPrefix: 'string'     // required (or fqdnSubdomain)
    agentPoolProfiles: [
      {
        name: 'string'      // required — max 12 chars, lowercase alphanumeric
        count: int           // required — number of nodes
        vmSize: 'string'     // required — e.g., 'Standard_DS2_v2'
        mode: 'string'       // required — 'System' or 'User'
      }
    ]
  }
}
```
