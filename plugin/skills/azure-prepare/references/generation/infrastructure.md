# Infrastructure Generation

Generate complete Bicep templates in `./infra` directory.

## TASK

Create production-ready Bicep templates based on architecture planning and service mapping.

## Generation Order

1. Generic resource modules (`./infra/modules/`)
2. Service-specific modules (`./infra/modules/`)
3. Main template (`./infra/main.bicep`)
4. Parameters file (`./infra/main.parameters.json`)

## File Templates

### main.bicep

```bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

var resourcePrefix = 'app'
var tags = {
  'azd-env-name': environmentName
}

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
    resourcePrefix: resourcePrefix
    tags: tags
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
// Add service-specific outputs
```

### main.parameters.json

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": {
      "value": "${AZURE_ENV_NAME}"
    },
    "location": {
      "value": "${AZURE_LOCATION}"
    }
  }
}
```

### Baseline Resources Module

```bicep
// modules/resources.bicep
param location string
param resourcePrefix string
param tags object

var uniqueHash = uniqueString(resourceGroup().id)

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${resourcePrefix}-log-${uniqueHash}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourcePrefix}-appi-${uniqueHash}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${resourcePrefix}-kv-${uniqueHash}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
  }
}

output logAnalyticsId string = logAnalytics.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
```

## Strategy

### Existing Files

When infra files already exist:

1. **Analyze** existing structure and patterns
2. **Preserve** customizations
3. **Add** missing resources
4. **Update** patterns to current standards
5. **Document** conflicts in manifest

### New Files

When generating fresh:

1. **Start** with baseline resources
2. **Add** hosting services per architecture
3. **Add** data services
4. **Configure** networking and security
5. **Export** required outputs

## MCP Tool Invocation

```
mcp_azure_mcp_deploy(command: "iac rules get", intent: "get Bicep generation standards")
```

## Checklist Format

Document in Preparation Manifest:

```markdown
## IaC File Checklist

| File | Status | Notes |
|------|--------|-------|
| infra/main.bicep | ✅ Generated | Subscription scope |
| infra/main.parameters.json | ✅ Generated | |
| infra/modules/resources.bicep | ✅ Generated | Baseline resources |
| infra/modules/containerapp.bicep | ✅ Generated | Generic module |
| infra/modules/api.bicep | ✅ Generated | API service |
```
