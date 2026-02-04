targetScope = 'subscription'

@description('Name of the environment')
param environmentName string

@description('Location for all resources')
param location string

var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module swa 'swa.bicep' = {
  name: 'swa'
  scope: rg
  params: {
    name: 'swa-${environmentName}'
    location: location
    tags: tags
  }
}

output AZURE_LOCATION string = location
output WEB_URI string = swa.outputs.uri
