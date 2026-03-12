## Required Properties (Bicep)

```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' = {
  name: 'string'       // required
  location: 'string'   // required
  sku: {
    name: 'string'     // recommended — 'Free' or 'Standard'
    tier: 'string'     // recommended — matches sku.name
  }
  properties: {
    repositoryUrl: 'string'     // optional — GitHub/Azure DevOps repo URL
    branch: 'string'            // optional — branch to deploy from
    repositoryToken: 'string'   // optional — GitHub PAT or Azure DevOps token
    buildProperties: {
      appLocation: 'string'     // optional — app source code path (default: '/')
      apiLocation: 'string'     // optional — API source code path
      outputLocation: 'string'  // optional — build output path
    }
  }
}
```
