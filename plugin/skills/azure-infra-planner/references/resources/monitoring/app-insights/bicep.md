## Required Properties (Bicep)

```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'string'       // required
  location: 'string'   // required
  kind: 'string'       // required — typically 'web'
  properties: {
    Application_Type: 'string'         // required — 'web' or 'other'
    WorkspaceResourceId: 'string'      // required for workspace-based (recommended)
  }
}
```
