param location string
param tags object
param applicationInsightsName string
param logAnalyticsWorkspaceResourceId string
param keyVaultName string
param connectionStringSecretName string

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceResourceId
    IngestionMode: 'LogAnalytics'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource applicationInsightsConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: connectionStringSecretName
  properties: {
    value: applicationInsights.properties.ConnectionString
  }
}

output connectionStringSecretName string = connectionStringSecretName
output applicationInsightsName string = applicationInsights.name
output connectionString string = applicationInsights.properties.ConnectionString
