## Required Properties (Bicep)

```bicep
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2025-02-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    sku: {
      name: 'string'   // recommended — defaults to 'PerGB2018'
    }
  }
}
```
