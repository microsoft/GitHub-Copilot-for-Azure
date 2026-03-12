## Required Properties (Bicep)

```bicep
resource containerAppEnv 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    appLogsConfiguration: {
      destination: 'string'           // recommended — 'log-analytics' or 'azure-monitor'
      logAnalyticsConfiguration: {
        customerId: 'string'          // required when destination is 'log-analytics'
        sharedKey: 'string'           // required when destination is 'log-analytics'
      }
    }
  }
}
```
