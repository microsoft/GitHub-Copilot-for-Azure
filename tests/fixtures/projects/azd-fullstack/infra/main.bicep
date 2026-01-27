targetScope = 'subscription'

param location string = 'eastus'
param environmentName string

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'rg-${environmentName}'
  location: location
}
