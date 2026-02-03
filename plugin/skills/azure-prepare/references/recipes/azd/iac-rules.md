# AZD IAC Rules

Rules for generating Bicep infrastructure for AZD projects.

## File Structure

| Requirement | Details |
|-------------|---------|
| Location | `./infra/` folder |
| Entry point | `main.bicep` with `targetScope = 'subscription'` |
| Parameters | `main.parameters.json` (REQUIRED) |
| Modules | `./infra/modules/*.bicep` with `targetScope = 'resourceGroup'` |

### main.parameters.json (REQUIRED)

**CRITICAL**: Always create `main.parameters.json` to map Bicep parameters to azd environment variables.

At minimum, include mappings for:
- `environmentName` → `${AZURE_ENV_NAME}`
- `location` → `${AZURE_LOCATION}`

**Example:**

```json
{
  "$schema": "https://json.schemastore.org/bicep-parameters.json",
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

For Azure Functions deployments, include any additional parameters required by your Bicep modules.

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

### Service Naming Consistency

**CRITICAL**: Ensure service names are consistent across all files to avoid deployment failures.

For Azure Functions deployments:
1. The service name in `azure.yaml` **MUST** match the `serviceName` parameter passed to the Bicep module
2. The Bicep module **MUST** tag the Function App with `azd-service-name: serviceName`
3. Common pattern: use `api` as the service name for Function apps

**Example:**

`azure.yaml`:
```yaml
services:
  api:
    project: ./src/api
    host: function
```

`main.bicep` (passing serviceName):
```bicep
module functionApp './modules/function-app.bicep' = {
  name: 'function-app'
  scope: rg
  params: {
    serviceName: 'api'  // Must match azure.yaml service name
    location: location
    tags: tags
  }
}
```

`modules/function-app.bicep` (tagging with azd-service-name):
```bicep
param serviceName string

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  tags: union(tags, { 'azd-service-name': serviceName })  // Required tag
  kind: 'functionapp,linux'
  // ... rest of configuration
}
```

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

## Pre-Deployment Verification

**CRITICAL**: Verify naming conventions before deployment to avoid failures.

### Verification Checklist

Before running `azd up` or `azd provision`, verify:

1. **Service name alignment**: Check that `azure.yaml` service names match Bicep `azd-service-name` tags
   - Review all services defined in `azure.yaml`
   - Verify corresponding Bicep modules tag resources with matching `azd-service-name` values
   
2. **Parameter mappings**: Validate that `main.parameters.json` exists with all required Bicep parameters
   - Ensure `environmentName` and `location` are mapped to azd environment variables
   - Verify any custom parameters have appropriate mappings

3. **Service-to-resource mapping**: For each service in `azure.yaml`:
   - Confirm a corresponding Bicep module exists
   - Verify the module receives the correct `serviceName` parameter
   - Check that the resource is tagged with `azd-service-name: serviceName`

**Example verification script:**
```bash
# Check azure.yaml service names
yq '.services | keys' azure.yaml

# Check Bicep tags (manual review of modules)
grep -r "azd-service-name" infra/

# Verify main.parameters.json exists
test -f infra/main.parameters.json && echo "✓ Parameters file exists" || echo "✗ Missing main.parameters.json"
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
