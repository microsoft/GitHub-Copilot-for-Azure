# Azure Functions CLI Commands

## Prerequisites

```bash
func --version          # Check Functions Core Tools
az account show         # Check Azure CLI auth
```

**Install Core Tools:**
```bash
npm install -g azure-functions-core-tools@4   # npm (all platforms)
brew install azure-functions-core-tools@4     # macOS
winget install Microsoft.AzureFunctionsCoreTools  # Windows
```

## Local Development

```bash
func init MyFunctionApp --worker-runtime node --model V4
func new --name HttpTrigger --template "HTTP trigger"
func start                    # Run locally at http://localhost:7071/api/
func start --port 7072        # Custom port
```

**Runtimes:** `node`, `python`, `dotnet`, `dotnet-isolated`, `java`, `powershell`

## Deploy

```bash
func azure functionapp publish $FUNCTION_APP
func azure functionapp publish $FUNCTION_APP --build remote   # TypeScript
func azure functionapp publish $FUNCTION_APP --slot staging   # Slot
```

## Configuration

```bash
az functionapp config appsettings set --name $APP -g $RG --settings "Key=Value"
az functionapp config appsettings list --name $APP -g $RG
az functionapp keys list -n $APP -g $RG
```

## Monitoring

```bash
func azure functionapp logstream $FUNCTION_APP   # Live logs
az functionapp log deployment list --name $APP -g $RG
```

## Create Resources (az CLI fallback)

```bash
az group create --name $RG --location eastus
az storage account create --name $STORAGE -g $RG --sku Standard_LRS
az functionapp create --name $APP -g $RG --storage-account $STORAGE \
  --flexconsumption-location eastus --runtime node --runtime-version 20
```
