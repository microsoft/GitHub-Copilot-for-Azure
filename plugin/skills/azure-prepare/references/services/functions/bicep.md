# Functions Bicep Patterns

## Basic Resource

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${resourcePrefix}func${uniqueHash}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}

resource functionAppPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-funcplan-${uniqueHash}'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: { reserved: true }
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: functionAppPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|18'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: applicationInsights.properties.ConnectionString }
      ]
    }
  }
}
```

## Premium Plan (No Cold Starts)

```bicep
resource functionAppPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-funcplan-${uniqueHash}'
  location: location
  sku: { name: 'EP1', tier: 'ElasticPremium' }
  properties: {
    reserved: true
    minimumElasticInstanceCount: 1
  }
}
```
