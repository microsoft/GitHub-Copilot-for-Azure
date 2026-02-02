# Azure Static Web Apps

Hosting patterns and best practices for Azure Static Web Apps.

## When to Use

- Single Page Applications (React, Vue, Angular)
- Static sites (HTML/CSS/JS)
- JAMstack applications
- Sites with serverless API backends
- Documentation sites

## Service Type in azure.yaml

```yaml
services:
  my-web:
    host: staticwebapp
    project: ./src/web
```

## Bicep Resource Pattern

```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'dist'
    }
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Static Web Apps is fully managed |
| Application Insights | Monitoring (optional) |

## SKU Selection

| SKU | Features |
|-----|----------|
| Free | 2 custom domains, 0.5GB storage, shared bandwidth |
| Standard | 5 custom domains, 2GB storage, SLA, auth customization |

## Build Configuration

### React

```yaml
buildProperties:
  appLocation: '/'
  outputLocation: 'build'
```

### Vue

```yaml
buildProperties:
  appLocation: '/'
  outputLocation: 'dist'
```

### Angular

```yaml
buildProperties:
  appLocation: '/'
  outputLocation: 'dist/my-app'
```

### Next.js (Static Export)

```yaml
buildProperties:
  appLocation: '/'
  outputLocation: 'out'
```

## API Integration

Integrated Functions API:

```
project/
├── src/           # Frontend
└── api/           # Azure Functions API
    ├── hello/
    │   └── index.js
    └── host.json
```

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
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{png,jpg,gif}"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/404.html"
    }
  }
}
```

## Authentication

Built-in providers:

```json
{
  "routes": [
    {
      "route": "/admin/*",
      "allowedRoles": ["admin"]
    }
  ],
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

Application settings for the integrated API:

```bicep
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2022-09-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    DATABASE_URL: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=db-url)'
  }
}
```

## Deployment

### Deployment with azd

Azure Developer CLI uses the SWA CLI (`swa deploy`) for deployments:

```bash
azd up --no-prompt
```

The deployment token is automatically retrieved from the provisioned Static Web App resource.

### Build Configuration

For pure static sites (no build step required):

```bicep
buildProperties: {
  appLocation: '/'
  outputLocation: '/'
  skipAppBuild: true
}
```

For sites with build steps (React, Vue, Angular, etc.):

```bicep
buildProperties: {
  appLocation: '/'
  outputLocation: 'dist'  # or 'build' for React
}
```

### Deployment Token

For CI/CD pipelines, retrieve the deployment token:

```bicep
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
```

Store this token as a secret in GitHub Actions or Azure DevOps.

To get the token via Azure CLI:

```bash
az staticwebapp secrets list --name <app-name> --query "properties.apiKey" -o tsv
```

### Direct Deployment with SWA CLI

For manual deployments without azd:

```bash
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy to production
swa deploy ./dist --deployment-token <token>

# Deploy with skip build (pure static)
swa deploy ./ --deployment-token <token> --no-build
```
