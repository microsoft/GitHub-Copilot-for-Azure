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
param containerAppName string
param containerAppsEnvironmentName string
param containerRegistryName string
param keyVaultName string
param logAnalyticsWorkspaceName string
param applicationInsightsName string

param appPort int = 3000
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param basePath string = '/wetty/'
param title string = 'WeTTY - The Web Terminal Emulator'
param sshHost string = 'localhost'
param sshPort int = 22
param sshUser string = ''
param sshAuth string = 'password'
param sshKeyPath string = ''
param knownHosts string = '/dev/null'
param sshConfig string = ''
param forceSsh bool = false
param command string = 'login'
param allowIframe bool = false
@description('Object ID of the deploying principal — grants Key Vault Secrets Officer for secret seeding')
param deployerObjectId string
@allowed(['User', 'ServicePrincipal', 'Group'])
param deployerPrincipalType string = 'User'

@secure()
param sshPassword string = ''

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

module logAnalytics './modules/log-analytics.bicep' = {
  name: 'log-analytics'
  scope: rg
  params: {
    location: location
    workspaceName: logAnalyticsWorkspaceName
    tags: tags
  }
}

module applicationInsights './modules/application-insights.bicep' = {
  name: 'application-insights'
  scope: rg
  params: {
    location: location
    applicationInsightsName: applicationInsightsName
    workspaceResourceId: logAnalytics.outputs.workspaceId
    tags: tags
  }
}

module containerRegistry './modules/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    location: location
    registryName: containerRegistryName
    tags: tags
  }
}

module keyVault './modules/key-vault.bicep' = {
  name: 'key-vault'
  scope: rg
  params: {
    location: location
    vaultName: keyVaultName
    appInsightsConnectionString: applicationInsights.outputs.connectionString
    deployerObjectId: deployerObjectId
    deployerPrincipalType: deployerPrincipalType
    sshPassword: sshPassword
    tags: tags
  }
}

module containerAppsEnvironment './modules/container-apps-environment.bicep' = {
  name: 'container-apps-environment'
  scope: rg
  dependsOn: [logAnalytics]
  params: {
    location: location
    managedEnvironmentName: containerAppsEnvironmentName
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    tags: tags
  }
}

module containerApp './modules/container-app.bicep' = {
  name: 'container-app'
  scope: rg
  dependsOn: [keyVault, containerRegistry, containerAppsEnvironment]
  params: {
    location: location
    containerAppName: containerAppName
    managedEnvironmentId: containerAppsEnvironment.outputs.id
    acrName: containerRegistryName
    keyVaultName: keyVaultName
    containerImage: containerImage
    appPort: appPort
    basePath: basePath
    title: title
    sshHost: sshHost
    sshPort: sshPort
    sshUser: sshUser
    sshAuth: sshAuth
    sshKeyPath: sshKeyPath
    knownHosts: knownHosts
    sshConfig: sshConfig
    forceSsh: forceSsh
    command: command
    allowIframe: allowIframe
    tags: tags
  }
}

output resourceGroupName string = rg.name
output containerAppUrl string = containerApp.outputs.url
output keyVaultUri string = keyVault.outputs.vaultUri
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
