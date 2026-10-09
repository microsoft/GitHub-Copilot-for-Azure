targetScope = 'resourceGroup'

@description('Primary location for all resources.')
param location string

@description('Tags to apply to all resources.')
param tags object = {}

@description('Environment name used for unique naming.')
param environmentName string

@description('Resource ID of the user-assigned managed identity for the sync function.')
param userAssignedIdentityId string

@description('Client ID of the user-assigned managed identity for the sync function.')
param userAssignedIdentityClientId string

@description('Principal ID of the user-assigned managed identity for the sync function.')
param userAssignedIdentityPrincipalId string

@description('Name of the existing MSBench nightly data storage account.')
param msbenchStorageAccountName string

@description('Name of the Azure Table for MSBench eval metrics.')
param msbenchEvalTableName string

@description('Name of the MSBench reports blob container.')
param msbenchReportsContainerName string

@description('Application Insights connection string for monitoring.')
param appInsightsConnectionString string

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, environmentName), 6)
var storagePrefix = take(replace(environmentName, '-', ''), 12)

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'sync${storagePrefix}${resourceSuffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    allowSharedKeyAccess: false
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'deploymentpackage'
}

resource deploymentStorageBlobDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, userAssignedIdentityPrincipalId, 'Storage Blob Data Contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
    )
    principalId: userAssignedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource hostingPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-${environmentName}-sync-${resourceSuffix}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    tier: 'FlexConsumption'
    name: 'FC1'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: 'func-${environmentName}-sync-${resourceSuffix}'
  location: location
  tags: union(tags, { 'azd-service-name': 'sync' })
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: hostingPlan.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}deploymentpackage'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: userAssignedIdentityId
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 10
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: 'https://${storageAccount.name}.blob.${environment().suffixes.storage}'
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: userAssignedIdentityId
        }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'AZURE_CLIENT_ID', value: userAssignedIdentityClientId }
        { name: 'MSBENCH_STORAGE_ACCOUNT', value: msbenchStorageAccountName }
        { name: 'MSBENCH_REPORTS_CONTAINER', value: msbenchReportsContainerName }
        { name: 'MSBENCH_EVAL_TABLE_NAME', value: msbenchEvalTableName }
      ]
    }
    httpsOnly: true
  }
}

output syncFunctionAppId string = functionApp.id
output syncFunctionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
