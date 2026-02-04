# Application Insights Identity-Based Authentication

When `DisableLocalAuth: true` is set on Application Insights (required by enterprise policies), you must configure identity-based authentication.

## Requirements

1. **Managed Identity**: Function App must have a system-assigned or user-assigned managed identity
2. **RBAC Role**: Assign `Monitoring Metrics Publisher` role to the identity on the Application Insights resource
3. **App Setting**: Configure authentication string

## Bicep Configuration

### System-Assigned Managed Identity

```bicep
// 1. Enable managed identity on Function App
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  // ... other properties
}

// 2. Assign Monitoring Metrics Publisher role to Function App identity
resource appInsightsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, monitoringMetricsPublisherRole, appInsights.id)
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb') // Monitoring Metrics Publisher
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// 3. Add authentication app setting
resource functionAppSettings 'Microsoft.Web/sites/config@2023-01-01' = {
  name: 'appsettings'
  parent: functionApp
  properties: {
    APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'Authorization=AAD'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    // ... other settings
  }
}
```

### User-Assigned Managed Identity

For user-assigned managed identity, include the client ID:

```bicep
// 1. Enable user-assigned identity
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
}

// 2. Assign role (same as system-assigned)
resource appInsightsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, appInsights.id, 'MonitoringMetricsPublisher')
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// 3. Add authentication string with client ID
resource functionAppSettings 'Microsoft.Web/sites/config@2023-01-01' = {
  name: 'appsettings'
  parent: functionApp
  properties: {
    APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'ClientId=${userAssignedIdentity.properties.clientId};Authorization=AAD'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    // ... other settings
  }
}
```

## Troubleshooting

**Symptom:** No traces appearing in Application Insights after deployment.

**Common causes:**
1. ❌ Missing `APPLICATIONINSIGHTS_AUTHENTICATION_STRING` app setting
2. ❌ Missing `Monitoring Metrics Publisher` role assignment
3. ❌ Incorrect client ID in authentication string (for user-assigned identity)
4. ❌ Managed identity not enabled on Function App

**Verification Steps:**

Check identity exists:
```bash
az functionapp identity show -g <resource-group> -n <function-app-name>
```

Check app setting exists:
```bash
az functionapp config appsettings list -g <resource-group> -n <function-app-name> \
  --query "[?name=='APPLICATIONINSIGHTS_AUTHENTICATION_STRING']"
```

Check role assignment exists:
```bash
az role assignment list \
  --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Insights/components/<app-insights-name> \
  --query "[?roleDefinitionName=='Monitoring Metrics Publisher']"
```

**Wait 5-10 minutes** for propagation, then test the function.

## See Also

- [enterprise-policy.md](enterprise-policy.md) - Enterprise policy compliance requirements
- [iac-rules.md](iac-rules.md) - IAC rules and security requirements
