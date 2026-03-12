## Required Properties (Bicep)

```bicep
resource mlWorkspace 'Microsoft.MachineLearningServices/workspaces@2025-06-01' = {
  name: 'string'         // required, 3-33 chars
  location: 'string'     // required
  identity: {
    type: 'string'       // required — 'SystemAssigned' | 'UserAssigned' | 'SystemAssigned,UserAssigned' | 'None'
  }
  sku: {
    name: 'string'       // required — see SKU Names table
    tier: 'string'       // optional — see SKU Names table
  }
  kind: 'string'         // optional — see Subtypes table
  properties: {
    storageAccount: 'string'        // ARM resource ID — required for Default/Hub
    keyVault: 'string'              // ARM resource ID — required for Default/Hub
    applicationInsights: 'string'   // ARM resource ID — recommended
    containerRegistry: 'string'     // ARM resource ID — optional
  }
}
```
