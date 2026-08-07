targetScope = 'subscription'

param environmentName string
param location string

resource resourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
}

module web './resources.bicep' = {
  name: 'web'
  scope: resourceGroup
  params: {
    location: location
    name: 'swa-${uniqueString(subscription().id, environmentName)}'
  }
}
