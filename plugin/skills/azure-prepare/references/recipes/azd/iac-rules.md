# AZD IAC Rules

Rules for generating Bicep infrastructure for AZD projects.

## File Structure

| Requirement | Details |
|-------------|---------|
| Location | `./infra/` folder |
| Entry point | `main.bicep` with `targetScope = 'subscription'` |
| Parameters | `main.parameters.json` |
| Modules | `./infra/modules/*.bicep` with `targetScope = 'resourceGroup'` |

## Naming Convention

**Pattern:** `{resourcePrefix}-{name}-{uniqueHash}`

```bicep
var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
var resourceName = '${name}-${resourceSuffix}'
```

**Forbidden:** Hard-coded tenant IDs, subscription IDs, resource group names

## Required Tags

| Tag | Apply To | Value |
|-----|----------|-------|
| `azd-env-name` | Resource group | `{environmentName}` |
| `azd-service-name` | Hosting resources (Container Apps, App Service, Functions, Static Web Apps) | Service name from azure.yaml |

## Module Parameters

All modules must accept:
- `name` (string)
- `location` (string)
- `tags` (object)

## Security Requirements

| Rule | Details |
|------|---------|
| No secrets | Use Key Vault references |
| Managed Identity | Follow least privilege |
| Diagnostics | Enable logging |
| API versions | Use latest |
| Enterprise policies | Include `disableLocalAuth: true` for services that support it |

## Enterprise Policy Compliance

Many organizations enforce Azure policies requiring identity-based authentication. **Always include these security properties** in generated Bicep to ensure compliance:

### Event Hubs Namespace
```bicep
resource eventHubNamespace 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: eventHubNamespaceName
  location: location
  properties: {
    disableLocalAuth: true  // Enforces managed identity authentication
  }
}
```

### Storage Account
```bicep
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  properties: {
    allowSharedKeyAccess: false  // Enforces managed identity/SAS tokens only
  }
}
```

### Application Insights
```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  properties: {
    Application_Type: 'web'
    DisableLocalAuth: true  // Enforces AAD authentication for telemetry
  }
}

// Required: Assign role for Function App to write metrics
resource appInsightsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, appInsights.id, 'MonitoringMetricsPublisher')
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

### Service Bus Namespace
```bicep
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: serviceBusNamespaceName
  location: location
  properties: {
    disableLocalAuth: true  // Enforces managed identity authentication
  }
}
```

### Function App Settings for App Insights

When `DisableLocalAuth: true` is set on Application Insights, add this app setting:

```bicep
resource functionAppSettings 'Microsoft.Web/sites/config@2023-01-01' = {
  name: 'appsettings'
  parent: functionApp
  properties: {
    APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'Authorization=AAD'
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    // For user-assigned identity, use:
    // APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'ClientId=${identity.clientId};Authorization=AAD'
  }
}
```

## Container Resources

```bicep
resources: {
  cpu: json('0.5')    // REQUIRED: wrap in json()
  memory: '1Gi'       // String with units
}
```

## main.bicep Template

```bicep
targetScope = 'subscription'

@description('Name of the environment')
param environmentName string

@description('Location for all resources')
param location string

var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources './modules/resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
  }
}
```

## Child Module Template

```bicep
targetScope = 'resourceGroup'

param name string
param location string = resourceGroup().location
param tags object = {}

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, name), 6)
```
