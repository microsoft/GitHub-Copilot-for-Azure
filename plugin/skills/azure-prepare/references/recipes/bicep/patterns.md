# Bicep Patterns

Common patterns for Bicep infrastructure templates.

## File Structure

```
infra/
├── main.bicep              # Entry point (subscription scope)
├── main.parameters.json    # Parameter values
└── modules/
    ├── resources.bicep     # Base resources
    ├── container-app.bicep # Container App module
    └── ...
```

## main.bicep Template

```bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

var tags = { environment: environmentName }

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
    environmentName: environmentName
    tags: tags
  }
}

output resourceGroupName string = rg.name
```

## main.parameters.json

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "dev" },
    "location": { "value": "eastus2" }
  }
}
```

## Naming Convention

```bicep
var resourceToken = uniqueString(subscription().id, resourceGroup().id, location)

// Pattern: {prefix}{name}{token}
// Azure resources have different naming rules

// Key Vault: alphanumeric + hyphens (3-24 chars)
var kvName = 'kv-${take(environmentName, 12)}-${resourceToken}'

// Storage: lowercase alphanumeric only (3-24 chars)
var storName = toLower(take(replace('st${environmentName}${resourceToken}', '-', ''), 24))

// Container Registry: alphanumeric only (5-50 chars)
var acrName = take(replace('cr${environmentName}${resourceToken}', '-', ''), 50)
```

## Security Requirements

| Requirement | Pattern |
|-------------|---------|
| No hardcoded secrets | Use Key Vault references |
| Managed Identity | `identity: { type: 'UserAssigned' }` |
| HTTPS only | `httpsOnly: true` |
| TLS 1.2+ | `minTlsVersion: '1.2'` |
| No public blob access | `allowBlobPublicAccess: false` |

## Common Modules

### Log Analytics

```bicep
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'log-${resourceToken}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}
```

### Application Insights

```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${resourceToken}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}
```

### Key Vault

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${resourceToken}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
  }
}
```

### Container Registry

```bicep
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: replace('cr${environmentName}${resourceToken}', '-', '')
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

output acrName string = containerRegistry.name
output acrLoginServer string = containerRegistry.properties.loginServer
```

> **⚠️ Important:** Container Registry names must be alphanumeric only. Use `replace()` to remove hyphens from environment names.

