# SWA Advanced Configuration

Advanced patterns for Azure Static Web Apps.

## GitHub-Linked Deployments

For CI/CD builds on Azure (instead of azd deploy):

```bicep
properties: {
  repositoryUrl: 'https://github.com/owner/repo'
  branch: 'main'
  buildProperties: {
    appLocation: '/'
    apiLocation: 'api'
    outputLocation: 'dist'
  }
}
```

## API Integration

Integrated Functions API structure:

```
project/
├── src/           # Frontend
└── api/           # Azure Functions API
    ├── hello/
    │   └── index.js
    └── host.json
```

For GitHub-linked deployments:
```bicep
buildProperties: {
  appLocation: 'src'
  apiLocation: 'api'
  outputLocation: 'dist'
}
```

## Custom Domains

```bicep
resource customDomain 'Microsoft.Web/staticSites/customDomains@2022-09-01' = {
  parent: staticWebApp
  name: 'www.example.com'
  properties: {}
}
```

## Route Configuration

Create `staticwebapp.config.json`:

```json
{
  "routes": [
    { "route": "/api/*", "allowedRoles": ["authenticated"] }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{png,jpg,gif}"]
  },
  "responseOverrides": {
    "404": { "rewrite": "/404.html" }
  }
}
```

## Authentication

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/{tenant-id}",
          "clientIdSettingName": "AAD_CLIENT_ID",
          "clientSecretSettingName": "AAD_CLIENT_SECRET"
        }
      }
    }
  }
}
```

## Environment Variables

```bicep
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2022-09-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    DATABASE_URL: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=db-url)'
  }
}
```

## Deployment Token

> ⚠️ **Security Warning:** Do NOT expose deployment tokens in ARM/Bicep outputs. Deployment outputs are visible in Azure portal deployment history and logs.

**Recommended approach** - retrieve token via Azure CLI and store directly in secret store (do not echo/log):

```bash
# Capture token to variable (output is sensitive - never echo or log)
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list --name <app-name> --query "properties.apiKey" -o tsv)

# Store directly in Key Vault or CI/CD secret store
az keyvault secret set --vault-name <vault-name> --name swa-deployment-token --value "$DEPLOYMENT_TOKEN" --output none
```

**Do NOT do this** (exposes token in deployment outputs):
```bicep
// ❌ INSECURE - token visible in deployment history
// output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
```
