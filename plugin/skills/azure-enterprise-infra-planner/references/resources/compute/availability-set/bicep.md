## Required Properties (Bicep)

```bicep
resource availSet 'Microsoft.Compute/availabilitySets@2024-11-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'Aligned'    // required for managed disks
  }
  properties: {
    platformFaultDomainCount: 2   // recommended, max 3 (region-dependent)
    platformUpdateDomainCount: 5  // recommended, max 20
  }
}
```
