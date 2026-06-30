@description('Location for all resources')
param location string = resourceGroup().location

param tags object = {}
param resourceToken string

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: 'swa-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output STATIC_WEB_APP_URL string = staticWebApp.properties.defaultHostname
