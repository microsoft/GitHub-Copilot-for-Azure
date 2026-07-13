@description('Location for all resources')
param location string = resourceGroup().location

param tags object = {}
param resourceToken string

// DTS built-in role: 0ad04412-c4d5-4796-b79c-f76d14c8d402
var dtsContributorRoleId = '0ad04412-c4d5-4796-b79c-f76d14c8d402'

resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: 'st${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'plan-${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {}
}

resource functionAppIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${resourceToken}'
  location: location
  tags: tags
}

resource dtsScheduler 'Microsoft.DurableTask/schedulers@2024-10-01-preview' = {
  name: 'dts-${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Dedicated'
    capacity: 1
  }
  properties: {
    ipAllowlist: ['0.0.0.0/0']
  }
}

resource dtsTaskHub 'Microsoft.DurableTask/schedulers/taskHubs@2024-10-01-preview' = {
  parent: dtsScheduler
  name: 'taskhub'
  properties: {}
}

resource dtsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(dtsScheduler.id, functionAppIdentity.id, subscriptionResourceId('Microsoft.Authorization/roleDefinitions', dtsContributorRoleId))
  scope: dtsScheduler
  properties: {
    principalId: functionAppIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', dtsContributorRoleId)
  }
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'func-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  kind: 'functionapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${functionAppIdentity.id}': {} }
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'DURABLE_TASK_SCHEDULER_CONNECTION_STRING'
          value: 'Endpoint=${dtsScheduler.properties.endpoint};TaskHub=${dtsTaskHub.name};Authentication=ManagedIdentity;ClientID=${functionAppIdentity.properties.clientId}'
        }
      ]
    }
    httpsOnly: true
  }
}

output API_URL string = 'https://${functionApp.properties.defaultHostName}'
