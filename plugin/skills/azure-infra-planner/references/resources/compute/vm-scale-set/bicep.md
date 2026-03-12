## Required Properties (Bicep)

```bicep
resource vmss 'Microsoft.Compute/virtualMachineScaleSets@2024-11-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'string'     // required — VM size
    tier: 'Standard'
    capacity: 2         // initial instance count
  }
  properties: {
    orchestrationMode: 'string'  // 'Flexible' (recommended) or 'Uniform'
    virtualMachineProfile: {     // required for Uniform; optional for Flexible
      storageProfile: {
        osDisk: {
          createOption: 'FromImage'
          managedDisk: {
            storageAccountType: 'Premium_LRS'
          }
        }
      }
      networkProfile: {
        networkInterfaceConfigurations: [
          {
            name: 'string'
            properties: {
              primary: true
              ipConfigurations: [
                {
                  name: 'string'
                  properties: {
                    subnet: {
                      id: 'string'  // subnet resource ID
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    }
  }
}
```
