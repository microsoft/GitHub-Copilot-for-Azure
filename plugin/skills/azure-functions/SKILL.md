---
name: azure-functions
description: Serverless event-driven compute with Azure Functions - pay-per-execution, auto-scaling, multiple trigger types, and deployment workflows
---

# Azure Functions

Azure Functions is a serverless compute service for event-driven applications. Pay only for execution time with automatic scaling.

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

## Quick Reference

| Property | Value |
|----------|-------|
| CLI prefix | `az functionapp`, `func` |
| MCP tools | `azure__functionapp` (command: `functionapp_list`) |
| Best for | Event-driven, pay-per-execution, serverless |

## Hosting Plans

**ALWAYS USE FLEX CONSUMPTION** for new deployments. All azd templates use Flex Consumption by default.

| Plan | Scaling | VNET | Use Case |
|------|---------|------|----------|
| **Flex Consumption** ⭐ | Auto, pay-per-execution | ✅ | **Default for all new projects** |
| Premium | Auto, pre-warmed | ✅ | Long-running, consistent load |
| Dedicated | Manual | ✅ | Predictable workloads |
| Consumption (legacy) | Auto, to 0 | ❌ | Dev/test only |

## Trigger Types

| Trigger | Use Case |
|---------|----------|
| HTTP | REST APIs, webhooks |
| Timer | Scheduled jobs (CRON) |
| Blob | File processing |
| Queue | Message processing |
| Event Grid | Event-driven |
| Cosmos DB | Change feed processing |
| Service Bus | Enterprise messaging |

---

## Prerequisites Validation

Validate all prerequisites before starting development or deployment.

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

If npm installation fails, use platform-specific installers:

```bash
# Windows (winget)
winget install Microsoft.AzureFunctionsCoreTools

# Windows (Chocolatey)
choco install azure-functions-core-tools

# macOS (Homebrew)
brew tap azure/functions
brew install azure-functions-core-tools@4

# Linux (Ubuntu/Debian)
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs)-prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list'
sudo apt-get update
sudo apt-get install azure-functions-core-tools-4
```

---

## Local Development

### Initialize Function Project

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

### Run Locally

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

### local.settings.json

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "MY_API_KEY": "local-dev-key"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*"
  }
}
```

---

## Deploy with Azure Developer CLI (ALWAYS USE FIRST)

**CRITICAL**: Always use `azd` for deployment. Only fall back to `az` CLI if azd is unavailable.

`azd` provides:
- **Flex Consumption** plan (required)
- Secure-by-default infrastructure
- Managed identity with RBAC
- Optional VNET with private endpoints

### Non-Interactive Deployment

```bash
# Generate environment name from project folder - NEVER PROMPT USER
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"

# Initialize with template and environment name
azd init -t <TEMPLATE> -e "$ENV_NAME"

# Configure and deploy without prompts
azd env set VNET_ENABLED false
azd up --no-prompt
```

### Template Selection by Runtime

| Runtime | Template |
|---------|----------|
| C# (.NET) | `azd init -t functions-quickstart-dotnet-azd` |
| JavaScript | `azd init -t functions-quickstart-javascript-azd` |
| TypeScript | `azd init -t functions-quickstart-typescript-azd` |
| Python | `azd init -t functions-quickstart-python-http-azd` |
| Java | `azd init -t azure-functions-java-flex-consumption-azd` |
| PowerShell | `azd init -t functions-quickstart-powershell-azd` |

**Key flags for non-interactive mode:**
| Flag | Purpose |
|------|---------|
| `-e <name>` | Set environment name (avoids prompt) |
| `-t <template>` | Specify template |
| `--no-prompt` | Skip all confirmations |

**Browse templates:** [Awesome AZD Functions](https://azure.github.io/awesome-azd/?tags=functions)

### What azd Creates (Secure-by-Default)
- **Flex Consumption plan** (required for new deployments)
- User-assigned managed identity
- RBAC role assignments (no connection strings)
- Storage with `allowSharedKeyAccess: false`
- App Insights with `disableLocalAuth: true`
- Optional VNET with private endpoints

---

## Create Azure Resources (az CLI Fallback)

**⚠️ FALLBACK ONLY**: Use this section only if `azd` is not available. Always prefer `azd` above.

Create Flex Consumption resources with managed identity (matching azd secure-by-default).

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
az identity create --name $IDENTITY_NAME --resource-group $RESOURCE_GROUP

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
    --allow-shared-key-access false

# Get storage account ID and assign RBAC
STORAGE_ID=$(az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query id -o tsv)
az role assignment create \
    --assignee-object-id $IDENTITY_PRINCIPAL \
    --assignee-principal-type ServicePrincipal \
    --role "Storage Blob Data Owner" \
    --scope $STORAGE_ID

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

# Configure managed identity storage access
STORAGE_BLOB_ENDPOINT=$(az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query primaryEndpoints.blob -o tsv)
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings \
        "AzureWebJobsStorage__credential=managedidentity" \
        "AzureWebJobsStorage__clientId=$IDENTITY_CLIENT_ID" \
        "AzureWebJobsStorage__blobServiceUri=$STORAGE_BLOB_ENDPOINT"
```

---

## Deploy Functions

Deploy functions to Azure using Azure Functions Core Tools.

```bash
# Deploy to Azure (from project root)
func azure functionapp publish $FUNCTION_APP

# Deploy with build (for TypeScript/compiled projects)
func azure functionapp publish $FUNCTION_APP --build remote

# Deploy with verbose output
func azure functionapp publish $FUNCTION_APP --verbose

# Deploy specific slot
func azure functionapp publish $FUNCTION_APP --slot staging

# Force update function app settings
func azure functionapp publish $FUNCTION_APP --publish-settings-only

# Upload local.settings.json to Azure
func azure functionapp publish $FUNCTION_APP --publish-local-settings
```

---

## Configuration Management

Manage application settings and connection strings.

```bash
# Set application setting
az functionapp config appsettings set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings "MySetting=MyValue"

# Set connection string
az functionapp config connection-string set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --connection-string-type SQLAzure \
    --settings "MyConnection=Server=..."

# List settings
az functionapp config appsettings list \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP

# Get function keys
az functionapp keys list -n $FUNCTION_APP -g $RESOURCE_GROUP
```

---

## Monitoring and Logs

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

---

## Deployment Slots (Premium/Dedicated Plans)

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

---

## CI/CD with GitHub Actions

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

---

## Durable Functions

For long-running orchestrations and stateful workflows:

```javascript
// Orchestrator
const df = require('durable-functions');

module.exports = df.orchestrator(function* (context) {
    const result1 = yield context.df.callActivity('Step1', input);
    const result2 = yield context.df.callActivity('Step2', result1);
    return result2;
});
```

**Patterns:**
- Function chaining
- Fan-out/fan-in
- Async HTTP APIs
- Human interaction
- Aggregator

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Keep functions small** | Single-purpose functions are easier to test and maintain |
| **Implement idempotency** | At-least-once triggers may execute multiple times |
| **Use managed identity** | Prefer managed identity over connection strings for secure resource access |
| **Configure timeout** | Set `functionTimeout` in host.json (default 5 min for Consumption) |
| **Use Application Insights** | Enable for monitoring, tracing, and diagnostics |
| **Secure HTTP functions** | Use `authLevel: 'function'` or `'admin'` for non-public endpoints |
| **Environment variables** | Store secrets in App Settings, not in code |
| **Cold start optimization** | Use Premium plan or keep-alive pings for latency-sensitive apps |
| **Use Key Vault** | Store secrets securely with Key Vault references |
| **Configure retry policies** | Set appropriate retry behavior for triggers |

---

## Quick Start Checklist

### Setup
- [ ] Azure subscription created
- [ ] Azure CLI installed (`az --version`)
- [ ] Azure CLI authenticated (`az login`)
- [ ] Azure Functions Core Tools installed (`func --version`)
- [ ] Node.js/Python/dotnet installed (based on runtime)

### Development
- [ ] Initialize project with `func init`
- [ ] Create functions with `func new`
- [ ] Configure `host.json` settings
- [ ] Test locally with `func start`

### Deployment
- [ ] Create resource group
- [ ] Create storage account
- [ ] Create Function App
- [ ] Deploy with `func azure functionapp publish`
- [ ] Configure app settings
- [ ] Verify function URLs

### Monitoring
- [ ] Enable Application Insights
- [ ] Stream logs with `func azure functionapp logstream`
- [ ] Set up alerts for failures

---

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| **func not found** | Command not recognized | Install Azure Functions Core Tools: `npm install -g azure-functions-core-tools@4` |
| **Storage error** | Function app won't start | Verify `AzureWebJobsStorage` connection string is valid |
| **404 on function** | Function not found | Check function is exported correctly and route is configured |
| **Cold start delays** | First request slow | Use Premium plan or implement warm-up triggers |
| **Timeout** | Function exceeds limit | Increase `functionTimeout` in host.json or use Durable Functions |
| **Binding errors** | Extension not loaded | Run `func extensions install` to install required extensions |
| **Deploy fails** | Publish error | Ensure function app exists and CLI is authenticated |
| **Runtime mismatch** | Version conflict | Verify `FUNCTIONS_EXTENSION_VERSION` matches project |
| **Execution limits** | Consumption has 5-10 min timeout | Use Premium or Dedicated plan for longer executions |
| **Scaling delays** | Cold starts on Consumption | Consider Premium plan with pre-warmed instances |

**Debug commands:**
```bash
func start --verbose                     # Local debugging
func azure functionapp logstream $APP    # Live logs
az functionapp show --name $APP          # App details
az functionapp config show --name $APP   # Configuration
az functionapp list --output table       # List all function apps
```

---

## Azure Resources

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.Web/sites` | Function App | 2023-12-01 |
| `Microsoft.Storage/storageAccounts` | Required storage | 2023-01-01 |
| `Microsoft.Web/serverfarms` | App Service Plan | 2023-12-01 |
| `Microsoft.Insights/components` | Application Insights | 2020-02-02 |

---

## MCP Server Tools

Use MCP tools to **query** existing resources:

- `azure__functionapp` with command `functionapp_list` - List function apps

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

---

## MCP Server Templates

Build AI-powered MCP servers using Azure Functions.

### MCP Extension (Preview) - Native MCPTrigger
| Language | Template |
|----------|----------|
| Python | [remote-mcp-functions-python](https://github.com/Azure-Samples/remote-mcp-functions-python) |
| TypeScript | [remote-mcp-functions-typescript](https://github.com/Azure-Samples/remote-mcp-functions-typescript) |
| C# | [remote-mcp-functions-dotnet](https://github.com/Azure-Samples/remote-mcp-functions-dotnet) |
| Java | [remote-mcp-functions-java](https://github.com/Azure-Samples/remote-mcp-functions-java) |

### MCP + API Management (OAuth)
| Language | Template |
|----------|----------|
| Python | [remote-mcp-apim-functions-python](https://github.com/Azure-Samples/remote-mcp-apim-functions-python) |

### Self-Hosted MCP SDK
| Language | Template |
|----------|----------|
| Python | [remote-mcp-sdk-functions-hosting-python](https://github.com/Azure-Samples/remote-mcp-sdk-functions-hosting-python) |
| TypeScript | [remote-mcp-sdk-functions-hosting-node](https://github.com/Azure-Samples/remote-mcp-sdk-functions-hosting-node) |
| C# | [remote-mcp-sdk-functions-hosting-dotnet](https://github.com/Azure-Samples/remote-mcp-sdk-functions-hosting-dotnet) |

**Browse:** [Awesome AZD MCP](https://azure.github.io/awesome-azd/?tags=msft&tags=functions&name=mcp) | [Remote MCP Docs](https://aka.ms/remote-mcp)

---

## Integration Templates

### Full-Stack (SWA + Functions)
| Stack | Sample |
|-------|--------|
| C# + SQL | [todo-csharp-sql-swa-func](https://github.com/Azure-Samples/todo-csharp-sql-swa-func) |
| Node + MongoDB | [todo-nodejs-mongo-swa-func](https://github.com/azure-samples/todo-nodejs-mongo-swa-func) |

### Database & AI Templates
| Service | Templates |
|---------|-----------|
| Cosmos DB | [Awesome AZD Cosmos](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) |
| Azure SQL | [Awesome AZD SQL](https://azure.github.io/awesome-azd/?tags=functions&name=sql) |
| OpenAI/AI Foundry | [Awesome AZD AI](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |

### Trigger & Binding Quick Reference
| Service | Trigger | Input | Output |
|---------|---------|-------|--------|
| Cosmos DB | ✅ | ✅ | ✅ |
| Azure SQL | ✅ | ✅ | ✅ |
| Storage Blob/Queue | ✅ | ✅ | ✅ |
| Service Bus | ✅ | ❌ | ✅ |
| Event Grid/Hubs | ✅ | ❌ | ✅ |
| Azure OpenAI | ❌ | ✅ | ✅ |
| SignalR | ✅ | ✅ | ✅ |

---

## Additional Resources

- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- [Triggers and Bindings](https://learn.microsoft.com/azure/azure-functions/functions-triggers-bindings)
- [Durable Functions](https://learn.microsoft.com/azure/azure-functions/durable/)
