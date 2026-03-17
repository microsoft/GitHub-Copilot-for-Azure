targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

var tags = { 'azd-env-name': environmentName }
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module swa './swa.bicep' = {
  name: 'swa-${resourceToken}'
  scope: rg
  params: {
    name: 'swa-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'dashboard' })
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_STATIC_WEB_APP_NAME string = swa.outputs.name
output AZURE_STATIC_WEB_APP_HOSTNAME string = swa.outputs.hostname
