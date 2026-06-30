targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

param sessionId string

param deployedBy string

param createdAt string

param resourceGroupName string
param appServicePlanName string
param appServiceName string
param keyVaultName string
param logAnalyticsName string
param appInsightsName string
param deployerObjectId string
@secure()
param sessionSecret string
param nodeRuntimeStack string = 'NODE|20-lts'
param nodeDefaultVersion string = '~20'
param appServiceHealthCheckPath string = '/'
param appServiceStartupCommand string = 'cd /home/site/wwwroot && node index.js'

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module keyVault './modules/key-vault.bicep' = {
  name: 'keyVault'
  scope: rg
  params: {
    location: location
    tags: tags
    keyVaultName: keyVaultName
    deployerObjectId: deployerObjectId
  }
}

module logAnalytics './modules/log-analytics.bicep' = {
  name: 'logAnalytics'
  scope: rg
  params: {
    location: location
    tags: tags
    workspaceName: logAnalyticsName
  }
}

module appServicePlan './modules/app-service-plan.bicep' = {
  name: 'appServicePlan'
  scope: rg
  params: {
    location: location
    tags: tags
    appServicePlanName: appServicePlanName
  }
}

module applicationInsights './modules/application-insights.bicep' = {
  name: 'applicationInsights'
  scope: rg
  params: {
    location: location
    tags: tags
    applicationInsightsName: appInsightsName
    logAnalyticsWorkspaceResourceId: logAnalytics.outputs.workspaceId
    keyVaultName: keyVault.outputs.keyVaultName
    connectionStringSecretName: 'applicationinsights-connection-string'
  }
}

module appService './modules/app-service.bicep' = {
  name: 'appService'
  scope: rg
  params: {
    location: location
    tags: tags
    appServicePlanId: appServicePlan.outputs.appServicePlanId
    appServiceName: appServiceName
    sessionSecret: sessionSecret
    applicationInsightsConnectionString: applicationInsights.outputs.connectionString
    nodeRuntimeStack: nodeRuntimeStack
    nodeDefaultVersion: nodeDefaultVersion
    healthCheckPath: appServiceHealthCheckPath
    startupCommand: appServiceStartupCommand
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

output resourceGroupName string = rg.name
output appServiceName string = appService.outputs.appServiceName
output keyVaultName string = keyVault.outputs.keyVaultName
