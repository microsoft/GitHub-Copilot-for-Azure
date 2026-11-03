param location string

var suffix = uniqueString(resourceGroup().id)

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'diag-plan-${suffix}'
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'diag-web-${suffix}'
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    enabled: false
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'diag${suffix}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'diag-logs-${suffix}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource expectedInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'diag-insights-current-${suffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

resource previousInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'diag-insights-previous-${suffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'diag-functions-${suffix}'
  location: location
  kind: 'functionapp,linux'
  tags: {
    ExpectedApplicationInsightsResourceId: expectedInsights.id
  }
  properties: {
    serverFarmId: plan.id
    enabled: true
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: previousInsights.properties.ConnectionString
        }
      ]
    }
  }
}
