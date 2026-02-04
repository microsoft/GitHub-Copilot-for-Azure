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

## Enterprise Policy Compliance

Many organizations enforce Azure policies requiring identity-based authentication. **Always include** `disableLocalAuth: true` or `allowSharedKeyAccess: false` in generated Bicep to ensure compliance.

**Required properties:**
- Event Hubs: `disableLocalAuth: true`
- Service Bus: `disableLocalAuth: true`
- Storage Account: `allowSharedKeyAccess: false`
- Application Insights: `DisableLocalAuth: true` (note capital D)

**For detailed examples and Application Insights authentication setup**, see:
- [enterprise-policy.md](enterprise-policy.md) - Full Bicep examples for all services
- [appinsights-auth.md](appinsights-auth.md) - Application Insights identity-based authentication with RBAC

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
