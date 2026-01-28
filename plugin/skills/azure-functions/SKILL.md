
---
name: azure-function-app-deployment
description: Deploy serverless functions to Azure Function Apps using Azure Developer CLI (azd) with secure-by-default infrastructure. Use this skill when deploying serverless APIs, event-driven functions, timer-triggered jobs, or webhook handlers to Azure Functions. Supports enterprise policies requiring managed identity, RBAC (no local auth), and VNET.
---

# Azure Function App Deployment

Automated deployment workflow for serverless applications to Azure Function Apps using Azure Developer CLI (azd) with secure-by-default infrastructure that supports enterprise policies.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Deploy my function to Azure"
- "Create a serverless API on Azure"
- "Deploy Azure Functions"
- "Set up a timer-triggered function in Azure"
- "Create webhooks in Azure"
- Any request involving **serverless functions**, **event-driven processing**, or **Azure Functions**

**Key Indicators:**
- Project uses Azure Functions (`host.json`, `local.settings.json` present)
- User mentions serverless, functions, triggers, or bindings
- User wants to deploy lightweight APIs without container management
- User needs timer jobs, queue processors, or event handlers

## Overview

This skill enables end-to-end deployment of serverless functions to Azure Function Apps. Azure Functions is a serverless compute service ideal for:
- **RESTful APIs** with HTTP triggers
- **Event-driven processing** responding to queues, blobs, or Event Grid
- **Timer-based jobs** for scheduled tasks
- **Webhook handlers** for integrations

```
Init → Develop → Test Locally → Deploy with azd → Monitor
```

### Secure-by-Default Architecture

All deployments use **secure-by-default** patterns that comply with common enterprise policies:
- **Managed Identity (User-Assigned)**: No connection strings or keys in app settings
- **RBAC-based Access**: Storage, Application Insights, and other resources use role assignments
- **No Local Auth**: `allowSharedKeyAccess: false` on storage, `disableLocalAuth: true` on App Insights
- **VNET Integration (Optional)**: Private endpoints for storage with virtual network integration

## When to Use

• **Serverless APIs**: Deploy HTTP-triggered functions for REST endpoints
• **Background processing**: Queue-triggered functions for async workloads
• **Scheduled tasks**: Timer-triggered functions for cron-like jobs
• **Event handlers**: Blob, Event Grid, or Service Bus triggered functions
• **Webhooks**: HTTP endpoints for third-party integrations

## Pattern 0: Prerequisites Validation

Validate all prerequisites before starting deployment.

```javascript
async function validatePrerequisites() {
  const checks = [];
  
  // Check Azure CLI authentication
  try {
    await exec('az account show');
    checks.push({ name: 'Azure CLI', status: 'authenticated' });
  } catch (error) {
    throw new Error('Not authenticated with Azure CLI. Run: az login');
  }
  
  // Check Azure Developer CLI (azd) - required for secure-by-default deployments
  try {
    await exec('azd version');
    checks.push({ name: 'Azure Developer CLI (azd)', status: 'installed' });
  } catch (error) {
    throw new Error('Azure Developer CLI not found. Install from: https://aka.ms/azd-install');
  }
  
  // Check Azure Functions Core Tools - install if not present
  try {
    await exec('func --version');
    checks.push({ name: 'Azure Functions Core Tools', status: 'installed' });
  } catch (error) {
    console.log('Azure Functions Core Tools not found. Installing...');
    try {
      await exec('npm install -g azure-functions-core-tools@4 --unsafe-perm true');
      checks.push({ name: 'Azure Functions Core Tools', status: 'installed (just now)' });
    } catch (installError) {
      throw new Error('Failed to install Azure Functions Core Tools. Please install manually: npm install -g azure-functions-core-tools@4');
    }
  }
  
  return checks;
}
```

### Platform-Specific Installation

**Azure Developer CLI (azd):**
```bash
# Windows (winget)
winget install Microsoft.Azd

# macOS (Homebrew)
brew install azd

# Linux (script)
curl -fsSL https://aka.ms/install-azd.sh | bash
```

**Azure Functions Core Tools:**
```bash
# Windows (winget)
winget install Microsoft.AzureFunctionsCoreTools

# macOS (Homebrew)
brew tap azure/functions
brew install azure-functions-core-tools@4

# npm (cross-platform)
npm install -g azure-functions-core-tools@4
```

**Key insight**: Azure Developer CLI (`azd`) is the recommended deployment method for secure-by-default infrastructure with managed identity, RBAC, and VNET support.

## Pattern 1: Initialize Function Project

Create a new Azure Functions project with the desired runtime.

```bash
# Create new function project
func init MyFunctionApp --worker-runtime node --model V4

# Create a new HTTP-triggered function
cd MyFunctionApp
func new --name HttpTrigger --template "HTTP trigger"

# For TypeScript
func init MyFunctionApp --worker-runtime node --language typescript --model V4
```

**Supported runtimes:** `node`, `python`, `dotnet`, `dotnet-isolated`, `java`, `powershell`, `custom`

### Project Structure

```
MyFunctionApp/
├── host.json              # Function app configuration
├── local.settings.json    # Local development settings
├── package.json           # Node.js dependencies
└── src/
    └── functions/
        └── HttpTrigger.js # Function code
```

## Pattern 2: Local Development

Test functions locally before deploying.

```bash
# Start local development server
func start

# Start with specific port
func start --port 7072

# Start with debugging enabled
func start --verbose
```

**Local endpoints:**
- HTTP triggers: `http://localhost:7071/api/{functionName}`
- Admin API: `http://localhost:7071/admin/functions`

### Example HTTP Function (Node.js v4)

```javascript
const { app } = require('@azure/functions');

app.http('HttpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('HTTP function processed a request.');
        const name = request.query.get('name') || await request.text() || 'World';
        return { body: `Hello, ${name}!` };
    }
});
```

### Example Timer Function

```javascript
const { app } = require('@azure/functions');

app.timer('TimerTrigger', {
    schedule: '0 */5 * * * *', // Every 5 minutes
    handler: async (myTimer, context) => {
        context.log('Timer trigger executed at:', new Date().toISOString());
    }
});
```

## Hosting Plans

| Plan | Use Case | Scaling | VNET Support | Managed Identity |
|------|----------|---------|--------------|------------------|
| **Flex Consumption** | Production serverless (recommended) | Auto-scale, pay per execution | ✅ Private endpoints | ✅ Full support |
| **Consumption** | Development/testing | Auto-scale, pay per execution | ❌ Limited | ✅ Full support |
| **Premium (EP1-EP3)** | Enhanced performance, long-running | Pre-warmed instances | ✅ Full integration | ✅ Full support |
| **Dedicated (App Service)** | Predictable workloads | Manual/auto-scale | ✅ Full integration | ✅ Full support |

**Recommendation**: Use **Flex Consumption** for new production workloads. It provides the best combination of serverless scaling, VNET support, and managed identity.

## Pattern 3: Deploy with Azure Developer CLI (Recommended)

The recommended approach uses Azure Developer CLI (`azd`) with official quickstart templates that implement secure-by-default patterns including managed identity, RBAC, and optional VNET.

### Official Quickstart Templates

Use these Microsoft-authored templates from [Awesome AZD](https://azure.github.io/awesome-azd/?tags=msft&tags=functions&name=http) based on your runtime:

| Language | Template Command |
|----------|------------------|
| **C# (.NET)** | `azd init -t functions-quickstart-dotnet-azd` |
| **JavaScript** | `azd init -t functions-quickstart-javascript-azd` |
| **TypeScript** | `azd init -t functions-quickstart-typescript-azd` |
| **Python** | `azd init -t functions-quickstart-python-http-azd` |
| **Java** | `azd init -t azure-functions-java-flex-consumption-azd` |
| **PowerShell** | `azd init -t functions-quickstart-powershell-azd` |

All templates use:
- **Azure Flex Consumption Plan** (serverless with enhanced performance)
- **Azure Verified Modules (AVM)** for Bicep infrastructure
- **User-assigned managed identity** with RBAC role assignments
- **Optional VNET integration** with private endpoints for storage

### Deploy Workflow

```bash
# Option 1: Initialize from template (new project)
azd init -t functions-quickstart-javascript-azd
cd <project-folder>

# Option 2: Initialize in existing project
azd init

# Deploy to Azure (provisions infrastructure + deploys code)
azd up
```

### VNET Configuration

By default, templates prompt for VNET enablement. To configure:

```bash
# Enable VNET (recommended for enterprise)
azd env set VNET_ENABLED true
azd up

# Disable VNET (simpler, faster deployment)
azd env set VNET_ENABLED false
azd up
```

### What `azd up` Creates (Secure-by-Default)

The infrastructure includes:

1. **Resource Group** with proper tagging
2. **User-Assigned Managed Identity** for the function app
3. **Storage Account** with:
   - `allowSharedKeyAccess: false` (no connection strings)
   - `allowBlobPublicAccess: false`
   - Private endpoints (when VNET enabled)
4. **RBAC Role Assignments**:
   - `Storage Blob Data Owner` on storage
   - `Storage Queue Data Contributor` (for Durable Functions)
   - `Storage Table Data Contributor` (for Durable Functions)
   - `Monitoring Metrics Publisher` on Application Insights
5. **Application Insights** with `disableLocalAuth: true`
6. **Log Analytics Workspace**
7. **Flex Consumption App Service Plan**
8. **Function App** with managed identity configuration
9. **Virtual Network** with subnets (when VNET enabled):
   - Private endpoint subnet
   - App integration subnet
10. **Private DNS Zones** for storage endpoints (when VNET enabled)

### Template Structure

The quickstart templates use this structure:
```
project/
├── azure.yaml                 # azd configuration
├── infra/
│   ├── main.bicep            # Main orchestration (uses AVM modules)
│   ├── main.parameters.json   # Parameters including VNET_ENABLED
│   ├── abbreviations.json     # Resource naming abbreviations
│   └── app/
│       ├── api.bicep          # Function app configuration
│       ├── rbac.bicep         # Role assignments
│       ├── vnet.bicep         # Virtual network
│       └── storage-PrivateEndpoint.bicep  # Private endpoints
├── src/                       # Function code
├── host.json
└── local.settings.json
```

### Key Bicep Patterns (Azure Verified Modules)

The templates use AVM modules. Reference implementation patterns:

**Storage with no local auth:**
```bicep
module storage 'br/public:avm/res/storage/storage-account:0.8.3' = {
  name: 'storage'
  params: {
    name: storageAccountName
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false  // Disable local authentication
    publicNetworkAccess: vnetEnabled ? 'Disabled' : 'Enabled'
    networkAcls: vnetEnabled ? { defaultAction: 'Deny' } : { defaultAction: 'Allow' }
  }
}
```

**Managed Identity:**
```bicep
module apiUserAssignedIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  name: 'apiUserAssignedIdentity'
  params: {
    name: identityName
    location: location
  }
}
```

**RBAC Role Assignments:**
```bicep
// Storage Blob Data Owner for managed identity
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentityPrincipalId, 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')
  scope: storageAccount
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}
```

**Function App with Managed Identity:**
```bicep
module api 'br/public:avm/res/web/site:0.15.1' = {
  name: 'functionapp'
  params: {
    kind: 'functionapp,linux'
    managedIdentities: {
      userAssignedResourceIds: [identityId]
    }
    appSettingsKeyValuePairs: {
      AzureWebJobsStorage__credential: 'managedidentity'
      AzureWebJobsStorage__clientId: identityClientId
      AzureWebJobsStorage__blobServiceUri: storageAccount.properties.primaryEndpoints.blob
    }
  }
}
```

## Pattern 4: Deploy with Azure CLI (Fallback)

Use Azure CLI when `azd` is not available or for specific customization needs. **Important**: Follow the same secure-by-default patterns as the azd templates.

### Create Resources with Managed Identity and RBAC

```bash
# Set variables
RESOURCE_GROUP="rg-myfunc-$(date +%s)"
LOCATION="eastus"
STORAGE_ACCOUNT="stmyfunc$(date +%s | tail -c 8)"
FUNCTION_APP="func-myapp-$(date +%s | tail -c 8)"
IDENTITY_NAME="id-myfunc"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create user-assigned managed identity
az identity create \
    --name $IDENTITY_NAME \
    --resource-group $RESOURCE_GROUP

# Get identity details
IDENTITY_ID=$(az identity show --name $IDENTITY_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)
IDENTITY_PRINCIPAL=$(az identity show --name $IDENTITY_NAME --resource-group $RESOURCE_GROUP --query principalId -o tsv)
IDENTITY_CLIENT_ID=$(az identity show --name $IDENTITY_NAME --resource-group $RESOURCE_GROUP --query clientId -o tsv)

# Create storage account with NO local auth (RBAC only)
az storage account create \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku Standard_LRS \
    --allow-blob-public-access false \
    --allow-shared-key-access false \
    --min-tls-version TLS1_2

# Get storage account ID
STORAGE_ID=$(az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query id -o tsv)

# Assign Storage Blob Data Owner to managed identity
az role assignment create \
    --assignee-object-id $IDENTITY_PRINCIPAL \
    --assignee-principal-type ServicePrincipal \
    --role "Storage Blob Data Owner" \
    --scope $STORAGE_ID

# Create deployment container using Azure CLI with logged-in identity
# (This works because your user has permissions; the function app will use managed identity)
DEPLOYMENT_CONTAINER="app-package-container"
az storage container create \
    --name $DEPLOYMENT_CONTAINER \
    --account-name $STORAGE_ACCOUNT \
    --auth-mode login

# Create Application Insights with no local auth
az monitor app-insights component create \
    --app "${FUNCTION_APP}-insights" \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --application-type web \
    --disable-local-auth true

# Get App Insights connection string
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
    --app "${FUNCTION_APP}-insights" \
    --resource-group $RESOURCE_GROUP \
    --query connectionString -o tsv)

# Get App Insights resource ID for RBAC
APPINSIGHTS_ID=$(az monitor app-insights component show \
    --app "${FUNCTION_APP}-insights" \
    --resource-group $RESOURCE_GROUP \
    --query id -o tsv)

# Assign Monitoring Metrics Publisher to managed identity
az role assignment create \
    --assignee-object-id $IDENTITY_PRINCIPAL \
    --assignee-principal-type ServicePrincipal \
    --role "Monitoring Metrics Publisher" \
    --scope $APPINSIGHTS_ID

# Create Function App (Flex Consumption) with managed identity
az functionapp create \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT \
    --flexconsumption-location $LOCATION \
    --runtime node \
    --runtime-version 20 \
    --functions-version 4 \
    --assign-identity $IDENTITY_ID

# Configure app settings for managed identity-based storage access
STORAGE_BLOB_ENDPOINT=$(az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query primaryEndpoints.blob -o tsv)

az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "AzureWebJobsStorage__credential=managedidentity" \
        "AzureWebJobsStorage__clientId=$IDENTITY_CLIENT_ID" \
        "AzureWebJobsStorage__blobServiceUri=$STORAGE_BLOB_ENDPOINT" \
        "APPLICATIONINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION_STRING" \
        "APPLICATIONINSIGHTS_AUTHENTICATION_STRING=ClientId=$IDENTITY_CLIENT_ID;Authorization=AAD"
```

### Add VNET Integration (Optional but Recommended)

```bash
# Create VNET
VNET_NAME="vnet-myfunc"
az network vnet create \
    --name $VNET_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --address-prefix 10.0.0.0/16

# Create subnet for private endpoints
az network vnet subnet create \
    --name private-endpoints-subnet \
    --resource-group $RESOURCE_GROUP \
    --vnet-name $VNET_NAME \
    --address-prefix 10.0.1.0/24 \
    --disable-private-endpoint-network-policies

# Create subnet for function app integration
az network vnet subnet create \
    --name app-subnet \
    --resource-group $RESOURCE_GROUP \
    --vnet-name $VNET_NAME \
    --address-prefix 10.0.2.0/24 \
    --delegations Microsoft.App/environments

# Disable public access on storage
az storage account update \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --public-network-access Disabled

# Create private endpoint for blob storage
az network private-endpoint create \
    --name pe-blob \
    --resource-group $RESOURCE_GROUP \
    --vnet-name $VNET_NAME \
    --subnet private-endpoints-subnet \
    --private-connection-resource-id $STORAGE_ID \
    --group-id blob \
    --connection-name blob-connection

# Create private DNS zone for blob
az network private-dns zone create \
    --name "privatelink.blob.core.windows.net" \
    --resource-group $RESOURCE_GROUP

# Link DNS zone to VNET
az network private-dns link vnet create \
    --name blob-dns-link \
    --resource-group $RESOURCE_GROUP \
    --zone-name "privatelink.blob.core.windows.net" \
    --virtual-network $VNET_NAME \
    --registration-enabled false

# Create DNS records
az network private-endpoint dns-zone-group create \
    --name blob-dns-group \
    --resource-group $RESOURCE_GROUP \
    --endpoint-name pe-blob \
    --private-dns-zone "privatelink.blob.core.windows.net" \
    --zone-name blob

# Configure function app VNET integration
SUBNET_ID=$(az network vnet subnet show --name app-subnet --resource-group $RESOURCE_GROUP --vnet-name $VNET_NAME --query id -o tsv)
az functionapp vnet-integration add \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --vnet $VNET_NAME \
    --subnet app-subnet
```

### Deploy Functions

```bash
# Deploy to Azure (from project root)
func azure functionapp publish $FUNCTION_APP

# For TypeScript/compiled projects
func azure functionapp publish $FUNCTION_APP --build remote
```

### RBAC Role Reference

| Role | ID | Purpose |
|------|-----|---------|
| Storage Blob Data Owner | `b7e6dc6d-f1e8-4753-8033-0f276bb0955b` | Function app access to deployment container and blob triggers |
| Storage Queue Data Contributor | `974c5e8b-45b9-4653-ba55-5f855dd0fb88` | Required for Durable Functions |
| Storage Table Data Contributor | `0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3` | Required for Durable Functions |
| Monitoring Metrics Publisher | `3913510d-42f4-4e42-8a64-420c390055eb` | App Insights telemetry with managed identity |

## Pattern 5: Configuration Management

Manage application settings for secure-by-default deployments.

### Managed Identity App Settings

When using managed identity (recommended), configure storage access without connection strings:

```bash
# Required settings for managed identity storage access
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "AzureWebJobsStorage__credential=managedidentity" \
        "AzureWebJobsStorage__clientId=$IDENTITY_CLIENT_ID" \
        "AzureWebJobsStorage__blobServiceUri=https://$STORAGE_ACCOUNT.blob.core.windows.net/"

# For Durable Functions, also add queue and table endpoints
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "AzureWebJobsStorage__queueServiceUri=https://$STORAGE_ACCOUNT.queue.core.windows.net/" \
        "AzureWebJobsStorage__tableServiceUri=https://$STORAGE_ACCOUNT.table.core.windows.net/"

# Application Insights with managed identity
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "APPLICATIONINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION_STRING" \
        "APPLICATIONINSIGHTS_AUTHENTICATION_STRING=ClientId=$IDENTITY_CLIENT_ID;Authorization=AAD"
```

### General Settings

```bash
# Set custom application settings
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings "MY_SETTING=value"

# List settings
az functionapp config appsettings list \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP
```

### local.settings.json (Local Development)

For local development, use the storage emulator or local managed identity:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*"
  }
}
```

**Note**: `local.settings.json` is for development only. In Azure, settings are configured through app settings with managed identity.

## Pattern 6: Monitoring and Logs

View function execution logs and diagnostics.

```bash
# Stream live logs
func azure functionapp logstream $FUNCTION_APP

# View deployment logs
az functionapp log deployment list \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP

# Enable Application Insights (recommended)
az monitor app-insights component create \
    --app $FUNCTION_APP-insights \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP

# Link App Insights to Function App (use connection string - instrumentationKey is deprecated)
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
    --app $FUNCTION_APP-insights \
    --resource-group $RESOURCE_GROUP \
    --query connectionString -o tsv)

az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$APPINSIGHTS_CONNECTION_STRING"
```

## Pattern 7: Deployment Slots (Premium/Dedicated Plans)

Use deployment slots for zero-downtime deployments.

```bash
# Create staging slot
az functionapp deployment slot create \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --slot staging

# Deploy to staging
func azure functionapp publish $FUNCTION_APP --slot staging

# Swap slots
az functionapp deployment slot swap \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --slot staging \
    --target-slot production
```

## Pattern 8: CI/CD with GitHub Actions 

Automate deployments with GitHub Actions.

> **Important**: Before creating CI/CD pipelines, get CI/CD guidance with `deploy_pipeline_guidance_get`.

`.github/workflows/azure-functions.yml`:
```yaml
name: Deploy Azure Functions

on:
  push:
    branches: [main]

env:
  AZURE_FUNCTIONAPP_NAME: 'myFunctionApp'
  AZURE_FUNCTIONAPP_PACKAGE_PATH: '.'
  NODE_VERSION: '20.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install dependencies
        run: npm ci
        working-directory: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
      
      - name: Build (if TypeScript)
        run: npm run build --if-present
        working-directory: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
      
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
          package: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
```

**Create Azure credentials secret:**
```bash
az ad sp create-for-rbac --name "github-actions-sp" \
    --role contributor \
    --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group} \
    --sdk-auth
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Use azd templates** | Start with [official quickstart templates](https://azure.github.io/awesome-azd/?tags=msft&tags=functions&name=http) for secure-by-default infrastructure |
| **Use managed identity** | Always use user-assigned managed identity instead of connection strings |
| **Disable local auth** | Set `allowSharedKeyAccess: false` on storage, `disableLocalAuth: true` on App Insights |
| **RBAC role assignments** | Grant only required roles: Storage Blob Data Owner, Monitoring Metrics Publisher |
| **Enable VNET** | Use private endpoints for storage in enterprise environments |
| **Use Azure Verified Modules** | Bicep templates should use [AVM](https://aka.ms/avm) for consistency and best practices |
| **Configure timeout** | Set `functionTimeout` in host.json (default 5 min for Consumption) |
| **Use Application Insights** | Enable for monitoring, tracing, and diagnostics with managed identity auth |
| **Secure HTTP functions** | Use `authLevel: 'function'` or `'admin'` for non-public endpoints |
| **Cold start optimization** | Use Flex Consumption or Premium plan for latency-sensitive apps |
| **Durable Functions** | Use for long-running orchestrations; requires Queue and Table RBAC roles |

## Quick Start Checklist

### Prerequisites
- [ ] Azure subscription created
- [ ] Azure Developer CLI installed (`azd version`)
- [ ] Azure CLI installed and authenticated (`az login`)
- [ ] Azure Functions Core Tools installed (`func --version`)
- [ ] Node.js/Python/dotnet installed (based on runtime)

### Development
- [ ] Initialize from quickstart template: `azd init -t functions-quickstart-<language>-azd`
- [ ] Or create new project: `func init` + `func new`
- [ ] Configure `host.json` settings
- [ ] Test locally with `func start`

### Deployment (azd - Recommended)
- [ ] Run `azd up` to provision and deploy
- [ ] Confirm VNET enabled if required: `azd env set VNET_ENABLED true`
- [ ] Verify managed identity and RBAC assignments
- [ ] Test deployed function endpoints

### Deployment (az CLI - Fallback)
- [ ] Create resource group
- [ ] Create user-assigned managed identity
- [ ] Create storage account with `--allow-shared-key-access false`
- [ ] Assign RBAC roles to managed identity
- [ ] Create Function App with `--assign-identity`
- [ ] Configure managed identity app settings
- [ ] Deploy with `func azure functionapp publish`

### Monitoring
- [ ] Verify Application Insights is connected with managed identity
- [ ] Stream logs with `func azure functionapp logstream`
- [ ] Set up alerts for failures

## Azure Resources

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.Web/sites` | Function App | 2023-12-01 |
| `Microsoft.Storage/storageAccounts` | Required storage | 2023-01-01 |
| `Microsoft.Web/serverfarms` | App Service Plan | 2023-12-01 |
| `Microsoft.Insights/components` | Application Insights | 2020-02-02 |

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| **azd not found** | Command not recognized | Install: `brew install azd` (macOS) or `winget install Microsoft.Azd` (Windows) |
| **func not found** | Command not recognized | Install: `npm install -g azure-functions-core-tools@4` |
| **Storage auth error** | 403 Forbidden on storage | Verify managed identity has `Storage Blob Data Owner` role assigned |
| **RBAC propagation** | Role assignment not working | Wait 5-10 minutes for RBAC to propagate, or redeploy |
| **Missing RBAC for Durable** | Durable Functions fail | Add `Storage Queue Data Contributor` and `Storage Table Data Contributor` roles |
| **App Insights auth error** | Telemetry not appearing | Verify `Monitoring Metrics Publisher` role and `APPLICATIONINSIGHTS_AUTHENTICATION_STRING` setting |
| **VNET connectivity** | Function can't reach storage | Verify private endpoints and DNS zones are configured correctly |
| **Storage public access denied** | Can't create deployment container | Use `az storage container create --auth-mode login` (uses your identity) |
| **404 on function** | Function not found | Check function is exported correctly and route is configured |
| **Cold start delays** | First request slow | Use Flex Consumption or Premium plan |
| **Deploy fails** | Publish error | Verify managed identity is assigned and has required roles |
| **Runtime mismatch** | Version conflict | Verify `FUNCTIONS_EXTENSION_VERSION` matches project |

### Debug Commands

```bash
# Check azd environment
azd env list
azd env get-values

# Verify managed identity assignment
az functionapp identity show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP

# List role assignments on storage
az role assignment list --scope $STORAGE_ID --output table

# Check function app settings
az functionapp config appsettings list --name $FUNCTION_APP --resource-group $RESOURCE_GROUP

# Stream live logs
func azure functionapp logstream $FUNCTION_APP

# View deployment logs
az functionapp log deployment list --name $FUNCTION_APP --resource-group $RESOURCE_GROUP

# Test storage connectivity from function app (requires Kudu/SCM access)
az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP --query defaultHostName
```

### Common RBAC Issues

**Problem**: Function app can't access storage after deployment

**Solution**: Ensure these role assignments exist:
```bash
# Check required roles
az role assignment list \
    --assignee $IDENTITY_PRINCIPAL \
    --scope $STORAGE_ID \
    --query "[].roleDefinitionName" -o tsv

# Should include: Storage Blob Data Owner
# For Durable Functions, also: Storage Queue Data Contributor, Storage Table Data Contributor
```

**Problem**: Application Insights telemetry not appearing

**Solution**: Verify managed identity auth is configured:
```bash
# Check app settings
az functionapp config appsettings list \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --query "[?name=='APPLICATIONINSIGHTS_AUTHENTICATION_STRING'].value" -o tsv

# Should be: ClientId=<client-id>;Authorization=AAD
```

## Integrated Services Samples & Patterns

Azure Functions integrates with many Azure services through triggers, bindings, and SDKs. Below are curated samples for common integration patterns.

### MCP (Model Context Protocol) Servers

Build AI-powered MCP servers using Azure Functions with the Functions extension and programming model:

| Resource | Description |
|----------|-------------|
| [MCP Samples on Awesome AZD](https://azure.github.io/awesome-azd/?tags=msft&tags=functions&name=mcp) | Microsoft-authored MCP templates using Azure Functions |
| [Remote MCP Documentation](https://aka.ms/remote-mcp) | Self-host MCP servers with OAuth / Built-in Auth (EasyAuth) support |

**Key capabilities:**
- Host MCP servers as Azure Functions endpoints
- Use managed identity for secure authentication
- Integrate with Azure AI services
- Support for OAuth and Built-in Auth (EasyAuth)

### Static Web Apps (SWA) with Functions Backend

Build full-stack applications with Static Web Apps frontend and Azure Functions API backend:

| Sample | Description |
|--------|-------------|
| [Todo App - C# + SQL + SWA](https://github.com/Azure-Samples/todo-csharp-sql-swa-func) | C# Functions with Azure SQL Database and SWA frontend |
| [Todo App - Node.js + MongoDB + SWA](https://github.com/azure-samples/todo-nodejs-mongo-swa-func) | Node.js Functions with MongoDB on Azure and SWA frontend |

**Pattern benefits:**
- Unified deployment with `azd up`
- Automatic API routing from SWA to Functions
- Managed authentication integration
- Global CDN distribution for static assets

### Cosmos DB Integration

Serverless data processing with Azure Cosmos DB triggers and bindings:

| Resource | Description |
|----------|-------------|
| [Cosmos DB + Functions Templates](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) | Awesome AZD templates for Cosmos DB integration |

**Common patterns:**
- **Change feed trigger**: React to document changes in real-time
- **Input/output bindings**: Read and write documents without SDK boilerplate
- **Event-driven architectures**: Process data streams with serverless compute

```javascript
// Example: Cosmos DB trigger (Node.js v4)
const { app } = require('@azure/functions');

app.cosmosDB('cosmosDBTrigger', {
    connection: 'CosmosDBConnection',
    databaseName: 'myDatabase',
    containerName: 'myContainer',
    createLeaseContainerIfNotExists: true,
    handler: async (documents, context) => {
        context.log(`Processing ${documents.length} documents`);
        for (const doc of documents) {
            context.log(`Document id: ${doc.id}`);
        }
    }
});
```

### Azure SQL Database Integration

Connect to Azure SQL using triggers, bindings, and the SQL binding extension:

| Resource | Description |
|----------|-------------|
| [SQL + Functions Templates](https://azure.github.io/awesome-azd/?tags=functions&name=sql) | Awesome AZD templates for SQL Database integration |

**Common patterns:**
- **SQL input binding**: Query data without connection management
- **SQL output binding**: Insert/upsert data with automatic batching
- **SQL trigger**: React to table changes (using change tracking)

```javascript
// Example: SQL input binding (Node.js v4)
const { app, input } = require('@azure/functions');

const sqlInput = input.sql({
    commandText: 'SELECT * FROM Products WHERE Category = @category',
    commandType: 'Text',
    parameters: '@category={category}',
    connectionStringSetting: 'SqlConnectionString'
});

app.http('getProducts', {
    methods: ['GET'],
    extraInputs: [sqlInput],
    handler: async (request, context) => {
        const products = context.extraInputs.get(sqlInput);
        return { jsonBody: products };
    }
});
```

### AI, OpenAI, Cognitive Services & Azure AI Foundry

Build intelligent applications with Azure AI services integration:

| Resource | Description |
|----------|-------------|
| [AI + Functions Templates](https://azure.github.io/awesome-azd/?tags=functions&name=ai) | Awesome AZD templates for AI integration |

**Integration options:**
- **Azure OpenAI bindings**: Simplified access to GPT models with input/output bindings
- **Azure AI Services SDK**: Direct integration with Cognitive Services
- **Azure AI Foundry**: Enterprise AI platform integration for production workloads
- **Semantic Kernel**: AI orchestration framework support

```javascript
// Example: Azure OpenAI text completion (Node.js v4)
const { app, input } = require('@azure/functions');

const openAIInput = input.generic({
    type: 'textCompletion',
    prompt: '{prompt}',
    model: 'gpt-4',
    maxTokens: 500
});

app.http('generateText', {
    methods: ['POST'],
    extraInputs: [openAIInput],
    handler: async (request, context) => {
        const completion = context.extraInputs.get(openAIInput);
        return { jsonBody: { response: completion.content } };
    }
});
```

### Integration Quick Reference

| Service | Trigger | Input Binding | Output Binding | SDK Available |
|---------|---------|---------------|----------------|---------------|
| **Cosmos DB** | ✅ Change feed | ✅ | ✅ | ✅ |
| **Azure SQL** | ✅ Change tracking | ✅ | ✅ | ✅ |
| **Azure Storage** | ✅ Blob/Queue | ✅ | ✅ | ✅ |
| **Event Grid** | ✅ | - | ✅ | ✅ |
| **Event Hubs** | ✅ | - | ✅ | ✅ |
| **Service Bus** | ✅ | - | ✅ | ✅ |
| **Azure OpenAI** | - | ✅ | ✅ | ✅ |
| **SignalR** | ✅ | ✅ | ✅ | ✅ |

## Attached Services & Integration Patterns

Azure Functions integrates with many Azure services through triggers, bindings, and SDKs. Use these reference samples and patterns when building functions that connect to databases, AI services, messaging systems, and frontend applications.

### Model Context Protocol (MCP) Integration

Build AI-powered MCP servers using Azure Functions for hosting and scaling.

| Pattern | Description | Samples |
|---------|-------------|---------|
| **MCP with Flex Consumption** | Host MCP servers using the Azure Functions extension | [Awesome AZD MCP Templates](https://azure.github.io/awesome-azd/?tags=msft&tags=functions&name=mcp) |
| **Remote MCP Servers** | Self-host MCP servers with OAuth/Built-in Auth (EasyAuth) | [Remote MCP Samples](https://aka.ms/remote-mcp) |
| **MCP Programming Model** | Use the Functions programming model for MCP endpoints | [Awesome AZD MCP Templates](https://azure.github.io/awesome-azd/?tags=msft&tags=functions&name=mcp) |

**Key capabilities:**
- Host MCP servers on Azure Functions Flex Consumption for serverless scaling
- Use Built-in Authentication (EasyAuth) for secure OAuth flows
- Leverage managed identity for secure connections to Azure services

### Static Web Apps (SWA) + Functions

Build full-stack applications with Static Web Apps frontend and Azure Functions backend API.

| Stack | Description | Sample |
|-------|-------------|--------|
| **C# + SQL + SWA** | Todo app with .NET Functions API and Azure SQL | [todo-csharp-sql-swa-func](https://github.com/Azure-Samples/todo-csharp-sql-swa-func) |
| **Node.js + MongoDB + SWA** | Todo app with Node.js Functions API and MongoDB | [todo-nodejs-mongo-swa-func](https://github.com/azure-samples/todo-nodejs-mongo-swa-func) |

**Pattern highlights:**
- SWA provides global CDN-backed static hosting
- Functions API runs as managed backend
- Automatic API routing from SWA to Functions
- Built-in authentication and authorization

### Cosmos DB Integration

Use Cosmos DB triggers and bindings for event-driven data processing.

| Pattern | Description | Samples |
|---------|-------------|---------|
| **Cosmos DB Trigger** | React to document changes with change feed | [Awesome AZD Cosmos Templates](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) |
| **Input/Output Bindings** | Read and write documents declaratively | [Awesome AZD Cosmos Templates](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) |
| **SDK Integration** | Direct SDK usage for complex queries | [Awesome AZD Cosmos Templates](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) |

**Example Cosmos DB trigger (Node.js v4):**
```javascript
const { app } = require('@azure/functions');

app.cosmosDB('cosmosDBTrigger', {
    connection: 'CosmosDBConnection',
    databaseName: 'myDatabase',
    containerName: 'myContainer',
    createLeaseContainerIfNotExists: true,
    handler: async (documents, context) => {
        context.log(`Processing ${documents.length} documents`);
        for (const doc of documents) {
            context.log(`Document id: ${doc.id}`);
        }
    }
});
```

### Azure SQL Database Integration

Connect to Azure SQL using bindings or SDK for relational data.

| Pattern | Description | Samples |
|---------|-------------|---------|
| **SQL Input Binding** | Query SQL data declaratively | [Awesome AZD SQL Templates](https://azure.github.io/awesome-azd/?tags=functions&name=sql) |
| **SQL Output Binding** | Insert/update data without boilerplate | [Awesome AZD SQL Templates](https://azure.github.io/awesome-azd/?tags=functions&name=sql) |
| **SQL Trigger** | React to table changes | [Awesome AZD SQL Templates](https://azure.github.io/awesome-azd/?tags=functions&name=sql) |

**Example SQL input binding (C#):**
```csharp
[Function("GetProducts")]
public static IActionResult GetProducts(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req,
    [SqlInput("SELECT * FROM Products WHERE Active = 1",
        "SqlConnectionString")] IEnumerable<Product> products)
{
    return new OkObjectResult(products);
}
```

### AI, OpenAI, Cognitive Services & Azure AI Foundry

Build intelligent applications with AI service integrations.

| Pattern | Description | Samples |
|---------|-------------|---------|
| **Azure OpenAI** | GPT models, embeddings, chat completions | [Awesome AZD AI Templates](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |
| **Cognitive Services** | Vision, speech, language processing | [Awesome AZD AI Templates](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |
| **Azure AI Foundry** | Unified AI development platform | [Awesome AZD AI Templates](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |
| **Semantic Kernel** | AI orchestration framework | [Awesome AZD AI Templates](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |

**Example Azure OpenAI integration (Python):**
```python
import azure.functions as func
from openai import AzureOpenAI

app = func.FunctionApp()

@app.route(route="chat")
def chat(req: func.HttpRequest) -> func.HttpResponse:
    client = AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        azure_ad_token_provider=get_bearer_token_provider(
            DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
        ),
        api_version="2024-02-01"
    )
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": req.params.get("prompt")}]
    )
    return func.HttpResponse(response.choices[0].message.content)
```

### Integration Quick Reference

| Service | Trigger | Input Binding | Output Binding | SDK |
|---------|---------|---------------|----------------|-----|
| **Cosmos DB** | ✅ Change feed | ✅ Read docs | ✅ Write docs | ✅ |
| **Azure SQL** | ✅ Change tracking | ✅ Query | ✅ Upsert | ✅ |
| **Azure Storage Blob** | ✅ Blob created/updated | ✅ Read blob | ✅ Write blob | ✅ |
| **Azure Storage Queue** | ✅ Queue message | ✅ Peek | ✅ Add message | ✅ |
| **Service Bus** | ✅ Queue/Topic message | ❌ | ✅ Send message | ✅ |
| **Event Grid** | ✅ Events | ❌ | ✅ Publish events | ✅ |
| **Event Hubs** | ✅ Stream events | ❌ | ✅ Send events | ✅ |
| **Azure OpenAI** | ❌ | ✅ Embeddings | ✅ Completions | ✅ |
| **SignalR** | ✅ Messages | ✅ Connection info | ✅ Send messages | ✅ |

### Finding More Templates

Use [Awesome AZD](https://azure.github.io/awesome-azd/) to discover templates by service:

```bash
# Browse all Functions templates
# Visit: https://azure.github.io/awesome-azd/?tags=functions

# Initialize from any template
azd init -t <template-name>
```

## Additional Resources

### Official Quickstart Templates (Secure-by-Default)
- [Awesome AZD Functions Templates](https://azure.github.io/awesome-azd/?tags=msft&tags=functions&name=http) - All language quickstarts
- [C# (.NET) Quickstart](https://github.com/Azure-Samples/functions-quickstart-dotnet-azd)
- [JavaScript Quickstart](https://github.com/Azure-Samples/functions-quickstart-javascript-azd)
- [TypeScript Quickstart](https://github.com/Azure-Samples/functions-quickstart-typescript-azd)
- [Python Quickstart](https://github.com/Azure-Samples/functions-quickstart-python-http-azd)
- [Java Quickstart](https://github.com/Azure-Samples/azure-functions-java-flex-consumption-azd)
- [PowerShell Quickstart](https://github.com/Azure-Samples/functions-quickstart-powershell-azd)

### Azure Verified Modules (AVM)
- [AVM Overview](https://aka.ms/avm) - Best practice Bicep/Terraform modules
- [AVM Storage Account Module](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/storage/storage-account)
- [AVM Web Site Module](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/web/site)
- [AVM Managed Identity Module](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/managed-identity/user-assigned-identity)

### Documentation
- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)
- [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- [Managed Identity for Azure Functions](https://learn.microsoft.com/azure/azure-functions/security-concepts#managed-identities)
- [Triggers and Bindings](https://learn.microsoft.com/azure/azure-functions/functions-triggers-bindings)
- [Durable Functions](https://learn.microsoft.com/azure/azure-functions/durable/)
