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

// TO-DO for post deployment: make role assignment for this MI and limit role assignment to read only for dashboard MI
// This MI has the following permissions to the msbenchnightlydata storage account:
// - Storage Blob Data Reader role on the storage account, which allows it to read blobs in any container. This is needed to read MSBench metrics stored in eval_report.json.
// - Storage Table Data Contributor role on the storage account, which allows it to read/write entities in any table. This is needed to store MSBench eval metrics in msbenchevalmetrics table that are retrieved from the eval_report.json files.
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
