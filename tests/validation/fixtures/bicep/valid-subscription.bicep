targetScope = 'subscription'

param location string = 'eastus'
param rgName string

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: rgName
  location: location
}

output resourceGroupId string = rg.id
