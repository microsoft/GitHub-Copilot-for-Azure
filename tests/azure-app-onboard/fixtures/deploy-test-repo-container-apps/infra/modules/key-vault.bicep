param location string
param vaultName string
param appInsightsConnectionString string
param deployerObjectId string = ''
@allowed(['User', 'ServicePrincipal', 'Group'])
param deployerPrincipalType string = 'User'
param tags object

@secure()
param sshPassword string = ''

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForTemplateDeployment: true
    softDeleteRetentionInDays: 7
    sku: {
      family: 'A'
      name: 'standard'
    }
    publicNetworkAccess: 'Enabled'
  }
}

resource appInsightsSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'applicationinsights-connection-string'
  parent: keyVault
  properties: {
    value: appInsightsConnectionString
  }
}

resource sshPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'ssh-password'
  parent: keyVault
  properties: {
    value: sshPassword
  }
}

resource deployerSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerObjectId)) {
  name: guid(keyVault.id, deployerObjectId, 'key-vault-secrets-officer')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')
    principalId: deployerObjectId
    principalType: deployerPrincipalType
  }
}

resource deployerSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerObjectId)) {
  name: guid(keyVault.id, deployerObjectId, 'key-vault-secrets-user')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: deployerObjectId
    principalType: deployerPrincipalType
  }
}

output id string = keyVault.id
output name string = keyVault.name
output vaultUri string = 'https://${keyVault.name}.vault.azure.net/'
