targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Name of the existing MSBench nightly data storage account.')
param msbenchStorageAccountName string = 'msbenchnightlydata'

@description('Name of the Azure Table for MSBench eval metrics.')
param msbenchEvalTableName string = 'msbenchevalmetrics'

@description('Name of the MSBench reports blob container.')
param msbenchReportsContainerName string = 'msbench-reports'

var tags = {
  'azd-env-name': environmentName
  skipDelete: true
  DoNotDelete: true
}

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module identity './modules/managed-identity.bicep' = {
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
  }
}

// The dashboard MI (identity) has the following permissions to the msbenchnightlydata storage account:
// - Storage Blob Data Reader: read blobs in any container (read MSBench metrics from eval_report.json).
// - Storage Table Data Reader: read entities in any table (read MSBench eval metrics from msbenchevalmetrics table).
//
// The sync MI (syncIdentity) has the following permissions to the msbenchnightlydata storage account:
// - Storage Blob Data Reader: read blobs in any container (read eval_report.json files for syncing).
// - Storage Table Data Contributor: read/write entities in any table (write MSBench eval metrics to msbenchevalmetrics table).
module syncIdentity './modules/managed-identity.bicep' = {
  name: 'syncIdentity'
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    suffix: '-sync'
  }
}

module storage './modules/storage.bicep' = {
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    principalId: identity.outputs.identityPrincipalId
  }
}

module appInsights './modules/appinsights.bicep' = {
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
  }
}

module functionApp './modules/function-app.bicep' = {
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    userAssignedIdentityId: identity.outputs.identityId
    userAssignedIdentityClientId: identity.outputs.identityClientId
    storageAccountName: storage.outputs.storageAccountName
    msbenchStorageAccountName: msbenchStorageAccountName
    msbenchEvalTableName: msbenchEvalTableName
    msbenchReportsContainerName: msbenchReportsContainerName
    appInsightsConnectionString: appInsights.outputs.appInsightsConnectionString
  }
}

module syncFunctionApp './modules/sync-function-app.bicep' = {
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    userAssignedIdentityId: syncIdentity.outputs.identityId
    userAssignedIdentityClientId: syncIdentity.outputs.identityClientId
    msbenchStorageAccountName: msbenchStorageAccountName
    msbenchEvalTableName: msbenchEvalTableName
    msbenchReportsContainerName: msbenchReportsContainerName
    appInsightsConnectionString: appInsights.outputs.appInsightsConnectionString
  }
}

module swa './modules/static-web-app.bicep' = {
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    functionAppResourceId: functionApp.outputs.functionAppId
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output WEB_URL string = swa.outputs.url
