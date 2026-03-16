## Required Properties (Bicep)

```bicep
resource webApp 'Microsoft.Web/sites@2024-11-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  kind: 'app'          // recommended — defaults to 'app'
  properties: {
    serverFarmId: 'string'  // required — resource ID of App Service Plan
    siteConfig: {}          // recommended — runtime config
  }
}
```
