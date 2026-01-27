// Test template with all resources from other skills - Can be removed from final PR if not needed as well
param location string = resourceGroup().location
param projectName string = 'myproject'

// ========================================
// From: azure-function-app-deployment
// ========================================

// Storage Account (required for Function App)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${projectName}storage'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

// App Service Plan for Function App (Consumption)
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${projectName}-plan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
}

// Function App
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${projectName}-func'
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: appServicePlan.id
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${projectName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

// ========================================
// From: azure-aca-deployment
// ========================================

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${projectName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${projectName}acr'
  location: location
  sku: {
    name: 'Basic'
  }
}

// Container Apps Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${projectName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${projectName}-app'
  location: location
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
      }
    }
    template: {
      containers: [
        {
          name: 'main'
          image: 'nginx:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

// Container Apps Job (Scheduled)
resource containerAppJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${projectName}-job'
  location: location
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 1800
      scheduleTriggerConfig: {
        cronExpression: '0 0 * * *'
      }
    }
    template: {
      containers: [
        {
          name: 'job'
          image: 'busybox:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
}

// ========================================
// From: azure-static-web-apps
// ========================================

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: '${projectName}-static'
  location: 'eastus2'
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}
