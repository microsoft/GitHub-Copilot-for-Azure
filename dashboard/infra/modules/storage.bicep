targetScope = 'resourceGroup'

@description('Primary location for all resources.')
param location string

@description('Tags to apply to all resources.')
param tags object = {}

@description('Environment name used for unique naming.')
param environmentName string

@description('Principal ID of the managed identity to assign the Storage Blob Data Reader role.')
param principalId string

@description('Name of the Azure Table that stores integration-test token usage history.')
param tokenUsageTableName string = 'integrationtokenusage'

@description('Name of the Azure Table that stores integration-test per-run tool usage history.')
param toolUsageTableName string = 'integrationtoolusage'

@description('Principal (object) ID of the user-assigned managed identity used by the integration test pipeline to write token usage rows (skillcitestidentity in the skillcitest resource group, GithubCopilotForAzure-Testing subscription).')
param ciTestIdentityPrincipalId string = '531282f7-49cb-4149-af74-6c84a5270e87'

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, environmentName), 6)
var storagePrefix = take(replace(environmentName, '-', ''), 14)
var storageBlobDataReaderRoleId = '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
var storageTableDataReaderRoleId = '76199698-9eea-4c19-bc75-cec21354c6b6'
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

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
  properties: {
    isVersioningEnabled: true
  }
}

resource managementPolicies 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          enabled: true
          name: 'deleteBlobVersionsAfter30Days'
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: [
                'blockBlob'
              ]
            }
            actions: {
              version: {
                delete: {
                  daysAfterCreationGreaterThan: 30
                }
              }
            }
          }
        }
      ]
    }
  }
}

resource integrationReportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'integration-reports'
}

resource manualIntegrationReportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'manual-integration-reports'
}

resource nonIntegrationContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'non-integration'
}

resource tableServices 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource tokenUsageTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableServices
  name: tokenUsageTableName
}

resource toolUsageTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableServices
  name: toolUsageTableName
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

// Allows the dashboard Function App identity to read token-usage and tool-usage entities from the tables.
resource storageTableDataReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, storageTableDataReaderRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataReaderRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Allows the integration test pipeline identity to write token-usage and tool-usage entities to the tables.
resource storageTableDataContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, ciTestIdentityPrincipalId, storageTableDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: ciTestIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output storageAccountName string = storageAccount.name
output tokenUsageTableName string = tokenUsageTable.name
output toolUsageTableName string = toolUsageTable.name
