targetScope = 'subscription'

param environmentName string
param location string

resource resourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
}

module containerApp './resources.bicep' = {
  name: 'containerApp'
  scope: resourceGroup
  params: {
    location: location
    suffix: uniqueString(subscription().id, environmentName)
    abbrs: loadJsonContent('abbreviations.json')
  }
}
