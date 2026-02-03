# Azure Functions Deployment

Deployment workflows for Azure Functions using AZD.

## Prerequisites

- Azure Functions project prepared with azd template
- `azure.yaml` exists and validated
- `.azure/preparation-manifest.md` status = `Validated`
- Azure Functions Core Tools installed (if using `func` commands)

## AZD Deployment

### Full Deployment (Infrastructure + Code)

```bash
# Deploy everything
azd up --no-prompt
```

### Infrastructure Only

```bash
# Provision infrastructure without deploying code
azd provision --no-prompt
```

### Application Only

```bash
# Deploy code to existing infrastructure
azd deploy --no-prompt
```

### Preview Changes

```bash
# Preview changes before deployment
azd provision --preview
```

## Environment Configuration

### Set AZD Environment Variables

These are for azd provisioning, not application runtime:

```bash
azd env set AZURE_LOCATION eastus
azd env set VNET_ENABLED false
```

> ⚠️ **Important**: `azd env set` sets variables for the azd provisioning process, NOT application environment variables.

### Application Settings

Configure application environment variables via:
1. **Bicep templates** - Define in resource app settings
2. **Azure CLI** - `az functionapp config appsettings set`
3. **local.settings.json** - Local development only

## Verify Deployment

### Check Function App Status

```bash
# Show deployment details
azd show

# Or use Azure CLI
az functionapp show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP
```

### List Functions

```bash
func azure functionapp list-functions $FUNCTION_APP
```

### Test Function Endpoint

```bash
# Get function URL
FUNCTION_URL=$(az functionapp function show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --function-name HttpExample \
    --query invokeUrlTemplate -o tsv)

# Test the function
curl $FUNCTION_URL
```

## Monitoring

### View Logs

```bash
# Stream logs
func azure functionapp logstream $FUNCTION_APP

# Or use Azure CLI
az webapp log tail \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP
```

### Application Insights

```bash
# Get App Insights connection string
az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query connectionString -o tsv
```

## Troubleshooting Deployment

### Common Issues

1. **Deployment timeout**: Increase timeout or use `--build remote`
2. **Missing dependencies**: Ensure package.json/requirements.txt is correct
3. **Function not appearing**: Check function.json bindings
4. **Cold start issues**: Consider Premium plan

### View Deployment Logs

```bash
# Get deployment logs
az functionapp deployment list \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP

# Get specific deployment log
az functionapp deployment show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --deployment-id <id>
```

## CI/CD Integration

### GitHub Actions

For automated deployments, see [cicd/README.md](../cicd/README.md) for GitHub Actions integration.

### Azure DevOps

```yaml
- task: AzureFunctionApp@1
  inputs:
    azureSubscription: '<service-connection>'
    appType: 'functionAppLinux'
    appName: '$(functionAppName)'
    package: '$(System.DefaultWorkingDirectory)/**/*.zip'
```

## Data Loss Warning

> ⚠️ **CRITICAL: `azd down` Data Loss Warning**
>
> `azd down` **permanently deletes ALL resources** in the environment, including:
> - **Function Apps** with all configuration and deployment slots
> - **Storage accounts** with all blobs and files
> - **Key Vault** with all secrets (use `--purge` to bypass soft-delete)
> - **Databases** with all data (Cosmos DB, SQL, etc.)
>
> **Best practices:**
> - Always use `azd provision --preview` before `azd up`
> - Use separate environments for dev/staging/production
> - Back up important data before running `azd down`

## Next Steps

After deployment:
1. Verify functions are running
2. Test endpoints
3. Monitor Application Insights
4. Set up alerts and monitoring
