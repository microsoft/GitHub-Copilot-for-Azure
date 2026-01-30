# Generate Infrastructure

Create Bicep templates in `./infra/`.

## Main Entry Point

**`./infra/main.bicep`:**

```bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

param principalId string = ''

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources './resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    principalId: principalId
  }
}

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
```

## Module Structure

Create modules in `./infra/modules/`:

| Service | Module File |
|---------|-------------|
| Container Apps | `container-app.bicep` |
| Container Apps Environment | `container-apps-environment.bicep` |
| Azure Functions | `function-app.bicep` |
| App Service | `app-service.bicep` |
| Static Web Apps | `static-web-app.bicep` |
| Cosmos DB | `cosmos-db.bicep` |
| PostgreSQL | `postgresql.bicep` |
| Key Vault | `key-vault.bicep` |
| Storage | `storage.bicep` |

See [../../generation/bicep-patterns.md](../../generation/bicep-patterns.md) for module templates.

## Parameters File

**`./infra/main.parameters.json`:**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" },
    "principalId": { "value": "${AZURE_PRINCIPAL_ID}" }
  }
}
```

## Output

- `./infra/main.bicep`
- `./infra/main.parameters.json`
- `./infra/modules/*.bicep`
