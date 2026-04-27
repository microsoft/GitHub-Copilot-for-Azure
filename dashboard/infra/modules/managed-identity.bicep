targetScope = 'resourceGroup'

@description('Primary location for all resources.')
param location string

@description('Tags to apply to all resources.')
param tags object = {}

@description('Environment name used for unique naming.')
param environmentName string

@description('Optional suffix for the identity name to support multiple identities.')
param suffix string = ''

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, environmentName), 6)

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${environmentName}${suffix}-${resourceSuffix}'
  location: location
  tags: tags
}

output identityId string = identity.id
output identityPrincipalId string = identity.properties.principalId
output identityClientId string = identity.properties.clientId
