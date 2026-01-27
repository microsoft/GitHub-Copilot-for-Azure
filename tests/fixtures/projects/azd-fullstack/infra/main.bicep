targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param name string

@minLength(1)
param location string

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'rg-${name}'
  location: location
}
