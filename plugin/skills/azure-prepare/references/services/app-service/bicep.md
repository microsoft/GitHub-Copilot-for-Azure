# App Service Bicep Patterns

## Basic Resource

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-plan-${uniqueHash}'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true  // Linux
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: true
      healthCheckPath: '/health'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
      ]
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}
```

## Docker Container Deployment with ACR (Managed Identity)

When deploying a containerized app from Azure Container Registry (ACR), use a managed identity for authentication and include the `AcrPull` role assignment in the Bicep template.

> ⚠️ **CRITICAL**: The `AcrPull` role assignment **MUST** be included in the Bicep template. Without it, App Service will fail to pull the container image and the deployment will fail with an authentication error that requires manual remediation.

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-plan-${uniqueHash}'
  location: location
  sku: {
    name: 'S1'
    tier: 'Standard'
  }
  properties: {
    reserved: true  // Linux
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistry.properties.loginServer}/${imageName}:${imageTag}'
      acrUseManagedIdentityCreds: true
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistry.properties.loginServer}'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
      ]
    }
    httpsOnly: true
  }
}

// AcrPull role definition ID: 7f951dda-4ed3-4680-a7ca-43fe172d538d
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webApp.id, containerRegistry.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

> 💡 **Tip:** Set `acrUseManagedIdentityCreds: true` in `siteConfig` so App Service uses the system-assigned managed identity to authenticate with ACR — no passwords or secrets required. Always set `principalType: 'ServicePrincipal'` in the role assignment to avoid a Graph API lookup and speed up RBAC propagation.

## Key Vault Integration

Reference secrets from Key Vault:

```bicep
appSettings: [
  {
    name: 'DATABASE_URL'
    value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=database-url)'
  }
]
```
