param location string = 'eastus'
param appName string

resource app 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: 'placeholder'
  }
}
