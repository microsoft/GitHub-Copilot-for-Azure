# Application Insights Identity-Based Authentication

When `DisableLocalAuth: true` is set on Application Insights (required by enterprise policies), you must configure identity-based authentication.

## Requirements

1. **Managed Identity**: Function App must have managed identity enabled
2. **RBAC Role**: `Monitoring Metrics Publisher` role on Application Insights
3. **App Setting**: `APPLICATIONINSIGHTS_AUTHENTICATION_STRING`

## Bicep Configuration

### System-Assigned Identity

```bicep
// 1. Enable managed identity
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  identity: { type: 'SystemAssigned' }
}

// 2. Assign role
resource appInsightsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, appInsights.id)
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// 3. Add app setting
resource functionAppSettings 'Microsoft.Web/sites/config@2023-01-01' = {
  name: 'appsettings'
  parent: functionApp
  properties: {
    APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'Authorization=AAD'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
  }
}
```

### User-Assigned Identity

For user-assigned identity, include client ID in authentication string:

```bicep
APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'ClientId=${userIdentity.properties.clientId};Authorization=AAD'
```

## Troubleshooting

**Symptom:** No traces in Application Insights

**Verify:**
```bash
# Check identity
az functionapp identity show -g <rg> -n <app>

# Check app setting
az functionapp config appsettings list -g <rg> -n <app> \
  --query "[?name=='APPLICATIONINSIGHTS_AUTHENTICATION_STRING']"

# Check role
az role assignment list --scope <app-insights-resource-id> \
  --query "[?roleDefinitionName=='Monitoring Metrics Publisher']"
```

Wait 5-10 minutes for propagation after deployment.

## See Also

- [enterprise-policy.md](enterprise-policy.md) - Policy compliance requirements
- [iac-rules.md](iac-rules.md) - IAC security rules
