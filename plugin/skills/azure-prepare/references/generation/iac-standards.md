# IaC Generation Standards

Authoritative rules for generating Bicep infrastructure templates.

## Critical Requirements

### File Structure

All infrastructure code lives in `./infra`:

```
infra/
├── main.bicep                 # Entry point, subscription scope
├── main.parameters.json       # Parameter values
└── modules/
    ├── containerapp.bicep     # Generic Container App module
    ├── storage.bicep          # Generic Storage module
    ├── user-api.bicep         # Service-specific module
    └── ...
```

### Scope

- `main.bicep` uses **subscription scope** to create resource group
- Modules use **resource group scope**

```bicep
// main.bicep
targetScope = 'subscription'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
}

module resources './modules/resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    // ...
  }
}
```

## Naming Conventions

### Pattern

```
{resourcePrefix}-{name}-{uniqueHash}
```

### Unique Hash Generation

```bicep
var uniqueHash = uniqueString(subscription().subscriptionId, resourceGroup().id, environment)
```

### Examples

| Resource | Name Pattern |
|----------|--------------|
| Container App | `${resourcePrefix}-api-${uniqueHash}` |
| Storage Account | `${resourcePrefix}stor${uniqueHash}` (no hyphens) |
| Key Vault | `${resourcePrefix}-kv-${uniqueHash}` |
| Log Analytics | `${resourcePrefix}-log-${uniqueHash}` |

## Security Requirements

### Forbidden

- ❌ Hard-coded secrets or connection strings
- ❌ Hard-coded tenant/subscription/resource group IDs
- ❌ Plain-text passwords in parameters
- ❌ Public blob access enabled by default
- ❌ HTTP-only endpoints

### Required

- ✅ Key Vault references for all secrets
- ✅ Managed Identity for service-to-service auth
- ✅ HTTPS only
- ✅ Minimum TLS 1.2
- ✅ RBAC over access policies

## Resource Patterns

### CPU Values

Use `json()` function for CPU:

```bicep
resources: {
  cpu: json('0.5')
  memory: '1Gi'
}
```

### Tagging

All resources should include tags:

```bicep
tags: {
  'azd-env-name': environment
  'azd-service-name': serviceName
}
```

### Latest API Versions

Use current stable API versions:

| Resource | API Version |
|----------|-------------|
| Container Apps | `2023-05-01` |
| App Service | `2022-09-01` |
| Storage | `2023-01-01` |
| Key Vault | `2023-07-01` |
| Cosmos DB | `2023-04-15` |

## Module Architecture

### Generic Modules

Reusable across services:

```bicep
// modules/containerapp.bicep
param name string
param location string
param environmentId string
param image string
param port int = 8080

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  properties: {
    environmentId: environmentId
    // ...
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
```

### Service-Specific Modules

Include business logic:

```bicep
// modules/user-api.bicep
param location string
param environmentId string
param databaseUrl string

module containerApp './containerapp.bicep' = {
  name: 'user-api-container'
  params: {
    name: 'user-api'
    location: location
    environmentId: environmentId
    image: 'user-api:latest'
    port: 3000
  }
}
```

## Parameter Files

### Structure

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

### AZD Environment Variables

| Variable | Purpose |
|----------|---------|
| `${AZURE_ENV_NAME}` | Environment name |
| `${AZURE_LOCATION}` | Deployment region |
| `${AZURE_SUBSCRIPTION_ID}` | Target subscription |
| `${AZURE_PRINCIPAL_ID}` | Current user/service principal |

## Output Requirements

Export values needed by azure.yaml:

```bicep
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer
output AZURE_KEY_VAULT_NAME string = keyVault.name
output SERVICE_API_URI string = 'https://${apiContainerApp.properties.configuration.ingress.fqdn}'
```
