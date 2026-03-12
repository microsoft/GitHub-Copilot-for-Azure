## Required Properties (Bicep)

```bicep
resource containerApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: 'string'       // required
  location: 'string'   // required
  properties: {
    environmentId: 'string'  // required — resource ID of Container Apps Environment
    template: {
      containers: [
        {
          name: 'string'     // required
          image: 'string'    // required — container image reference
          resources: {
            cpu: json('0.5') // recommended
            memory: '1Gi'    // recommended
          }
        }
      ]
    }
  }
}
```
