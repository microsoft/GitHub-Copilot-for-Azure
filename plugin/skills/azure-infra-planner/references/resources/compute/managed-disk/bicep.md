## Required Properties (Bicep)

```bicep
resource disk 'Microsoft.Compute/disks@2025-01-02' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'string'     // required — see SKU Names table
  }
  properties: {
    creationData: {
      createOption: 'string'  // required — see values below
    }
    diskSizeGB: 128           // required for 'Empty' createOption
  }
}
```
