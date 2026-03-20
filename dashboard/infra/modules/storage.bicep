targetScope = 'resourceGroup'

@description('Primary location for all resources.')
param location string

@description('Tags to apply to all resources.')
param tags object = {}

@description('Environment name used for unique naming.')
param environmentName string

@description('Principal ID of the managed identity to assign the Storage Blob Data Reader role.')
param principalId string

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, environmentName), 6)
var storagePrefix = take(replace(environmentName, '-', ''), 14)
var storageBlobDataReaderRoleId = '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'str${storagePrefix}${resourceSuffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource integrationReportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'integration-reports'
}

resource storageBlobDataReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, storageBlobDataReaderRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataReaderRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output storageAccountName string = storageAccount.name
