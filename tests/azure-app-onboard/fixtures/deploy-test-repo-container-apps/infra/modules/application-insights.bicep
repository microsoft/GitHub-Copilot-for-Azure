param location string
param applicationInsightsName string
param workspaceResourceId string
param tags object

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspaceResourceId
    IngestionMode: 'LogAnalytics'
    DisableIpMasking: false
  }
}

output connectionString string = applicationInsights.properties.ConnectionString
output id string = applicationInsights.id
