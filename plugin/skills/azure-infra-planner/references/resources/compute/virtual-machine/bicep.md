## Required Properties (Bicep)

```bicep
resource vm 'Microsoft.Compute/virtualMachines@2024-11-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    hardwareProfile: {
      vmSize: 'string'  // required — e.g. 'Standard_D2s_v5'
    }
    storageProfile: {
      osDisk: {
        createOption: 'string'  // required — 'FromImage', 'Attach', 'Empty'
      }
    }
    osProfile: {              // required when createOption = 'FromImage'
      computerName: 'string'
      adminUsername: 'string'
      adminPassword: 'string' // or use SSH key for Linux
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: 'string'  // required — NIC resource ID
        }
      ]
    }
  }
}
```
