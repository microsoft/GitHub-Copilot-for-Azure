## Required Properties (Bicep)

```bicep
resource functionApp 'Microsoft.Web/sites@2024-11-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  kind: 'functionapp'  // required for function apps
  properties: {
    serverFarmId: 'string'  // required — resource ID of App Service Plan
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'string' }          // required
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }      // required
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'string' }     // required
      ]
    }
  }
}
```
