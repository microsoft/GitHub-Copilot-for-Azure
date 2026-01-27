# Multi-Service Deployment Guide

Deploy complex applications with multiple services using Azure Developer CLI (azd) and Infrastructure as Code.

---

## When to Use azd + IaC

Use this approach when your application has:
- Multiple deployable components (frontend + API + workers)
- Database, cache, or messaging dependencies
- Multiple environments (dev, staging, production)
- Team collaboration needs
- Reproducible infrastructure requirements

---

## Quick Start

```bash
# Initialize azd project
azd init

# Provision infrastructure + deploy code
azd up

# Or separately:
azd provision  # Create Azure resources
azd deploy     # Deploy application code
```

---

## Project Structure

```
project/
├── azure.yaml                 # azd service definitions
├── infra/                     # Infrastructure as Code
│   ├── main.bicep             # Main infrastructure
│   ├── main.parameters.json   # Parameter values
│   └── modules/               # Reusable modules (optional)
├── src/
│   ├── web/                   # Frontend service
│   │   └── package.json
│   ├── api/                   # Backend API service
│   │   └── package.json
│   └── functions/             # Azure Functions
│       └── host.json
└── .azure/                    # azd environment files (gitignored)
```

---

## azure.yaml Configuration

### Basic Example

```yaml
name: my-application
metadata:
  template: my-app@1.0.0

services:
  web:
    project: ./src/web
    language: js
    host: staticwebapp
    
  api:
    project: ./src/api
    language: js
    host: appservice
    
  functions:
    project: ./src/functions
    language: js
    host: function
```

### Complete Example with Hooks

```yaml
name: fullstack-app
metadata:
  template: fullstack@1.0.0

infra:
  provider: bicep
  path: infra
  module: main

services:
  web:
    project: ./src/web
    language: js
    host: staticwebapp
    dist: dist
    hooks:
      prepackage:
        shell: sh
        run: npm run build
        
  api:
    project: ./src/api
    language: js
    host: containerapp
    docker:
      path: ./src/api/Dockerfile
    hooks:
      predeploy:
        shell: sh
        run: npm run build

  worker:
    project: ./src/worker
    language: python
    host: function

hooks:
  preprovision:
    shell: sh
    run: echo "Preparing infrastructure..."
  postprovision:
    shell: sh
    run: |
      echo "Infrastructure ready!"
      az webapp config appsettings set --name $API_NAME --settings KEY=value
```

### Host Options

| Host | Service | Use Case |
|------|---------|----------|
| `staticwebapp` | Static Web Apps | Static frontends |
| `appservice` | App Service | Full web apps, APIs |
| `function` | Azure Functions | Serverless functions |
| `containerapp` | Container Apps | Containerized apps |
| `aks` | AKS | Kubernetes workloads |

### Language Options

`js`, `ts`, `python`, `csharp`, `java`, `go`

---

## Infrastructure as Code (Bicep)

### Minimal main.bicep

```bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

var tags = { 'azd-env-name': environmentName }
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module web 'modules/staticwebapp.bicep' = {
  name: 'web'
  scope: rg
  params: {
    name: 'swa-${resourceToken}'
    location: location
    tags: tags
  }
}

module api 'modules/appservice.bicep' = {
  name: 'api'
  scope: rg
  params: {
    name: 'api-${resourceToken}'
    location: location
    tags: tags
  }
}

output AZURE_LOCATION string = location
output WEB_URI string = web.outputs.uri
output API_URI string = api.outputs.uri
```

### Using Azure Verified Modules

See [Azure Verified Modules Reference](./azure-verified-modules.md) for complete module catalog.

```bicep
// Use AVM for App Service
module appService 'br/public:avm/res/web/site:0.3.0' = {
  name: 'appService'
  scope: rg
  params: {
    name: 'app-${resourceToken}'
    location: location
    kind: 'app,linux'
    serverFarmResourceId: appServicePlan.outputs.resourceId
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
    }
  }
}
```

---

## Environment Management

```bash
# Create new environment
azd env new dev
azd env new staging
azd env new production

# Switch environments
azd env select staging

# List environments
azd env list

# Set environment variables
azd env set DATABASE_URL "connection-string"
azd env set API_KEY "secret-value"

# Get environment values
azd env get-values
```

### Environment-Specific Parameters

Create `infra/main.parameters.json`:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" },
    "sku": { "value": "${SKU:=B1}" }
  }
}
```

---

## Common Architectures

### Frontend + API + Database

```yaml
# azure.yaml
name: web-api-db
services:
  web:
    project: ./frontend
    host: staticwebapp
  api:
    project: ./backend
    host: appservice
```

```bicep
// infra/main.bicep
module database 'br/public:avm/res/document-db/database-account:0.4.0' = {
  name: 'cosmos'
  scope: rg
  params: {
    name: 'cosmos-${resourceToken}'
    location: location
    locations: [{ locationName: location, failoverPriority: 0 }]
    sqlDatabases: [{
      name: 'appdb'
      containers: [{ name: 'items', partitionKeyPath: '/id' }]
    }]
  }
}

// Pass connection string to API
module api 'br/public:avm/res/web/site:0.3.0' = {
  params: {
    appSettingsKeyValuePairs: {
      COSMOS_CONNECTION: database.outputs.connectionStrings[0]
    }
  }
}
```

### Microservices with Container Apps

```yaml
name: microservices
services:
  gateway:
    project: ./services/gateway
    host: containerapp
  users:
    project: ./services/users
    host: containerapp
  orders:
    project: ./services/orders
    host: containerapp
```

### Event-Driven with Functions

```yaml
name: event-driven
services:
  api:
    project: ./api
    host: appservice
  processor:
    project: ./functions/processor
    host: function
  notifications:
    project: ./functions/notifications
    host: function
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install azd
        uses: Azure/setup-azd@v1
        
      - name: Log in to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
          
      - name: Provision and Deploy
        run: azd up --no-prompt
        env:
          AZURE_ENV_NAME: production
          AZURE_LOCATION: eastus
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

### Azure DevOps Pipeline

```yaml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - task: setup-azd@0
  
  - task: AzureCLI@2
    inputs:
      azureSubscription: 'MyServiceConnection'
      scriptType: bash
      scriptLocation: inlineScript
      inlineScript: |
        azd up --no-prompt
    env:
      AZURE_ENV_NAME: production
```

---

## Commands Reference

```bash
# Initialize
azd init                    # Interactive setup
azd init --template <url>   # From template

# Provision & Deploy
azd up                      # Provision + deploy
azd provision               # Only create infrastructure
azd deploy                  # Only deploy code
azd deploy --service web    # Deploy single service

# Environment
azd env new <name>
azd env select <name>
azd env list
azd env get-values
azd env set KEY value

# Monitoring
azd monitor                 # Open Application Insights

# Cleanup
azd down                    # Delete all resources
azd down --purge            # Also purge soft-deleted resources
```

---

## Troubleshooting

### Provision Fails

```bash
# Check detailed logs
azd provision --debug

# Validate Bicep
az bicep build --file infra/main.bicep
```

### Deploy Fails

```bash
# Check service logs
azd deploy --debug

# Deploy single service to isolate issue
azd deploy --service api
```

### Reset Environment

```bash
# Delete and recreate
azd down --purge
azd up
```
