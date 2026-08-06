targetScope = 'subscription'

param environmentName string
param location string

resource resourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
}

module functionApp './resources.bicep' = {
  name: 'functionApp'
  scope: resourceGroup
  params: {
    location: location
    name: 'func-${uniqueString(subscription().id, environmentName)}'
  }
}
