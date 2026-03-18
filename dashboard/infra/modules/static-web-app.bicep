targetScope = 'resourceGroup'

@description('Primary location for the Static Web App.')
param location string

@description('Tags to apply to all resources.')
param tags object = {}

@description('Environment name used for unique naming.')
param environmentName string

@description('Resource ID of the Function App to link as backend.')
param functionAppResourceId string

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, environmentName), 6)

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: 'stapp-${environmentName}-${resourceSuffix}'
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
    }
  }
}

resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2022-09-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: functionAppResourceId
    region: location
  }
}

output url string = 'https://${staticWebApp.properties.defaultHostname}'
