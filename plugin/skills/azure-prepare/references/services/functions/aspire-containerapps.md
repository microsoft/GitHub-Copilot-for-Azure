# Azure Functions on Container Apps (Aspire)

When deploying Azure Functions to Container Apps (common in .NET Aspire apps), **file-based secret storage must be configured** when using identity-based storage access.

> ⚠️ **Critical for Aspire:** If your Function App uses identity-based storage (e.g., `AzureWebJobsStorage__accountName` or `AzureWebJobsStorage__blobServiceUri`), you **must** add `AzureWebJobsSecretStorageType=Files`.

## Bicep Configuration

```bicep
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionAppPlan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}deploymentpackage'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      runtime: {
        name: 'dotnet-isolated'
        version: '8.0'
      }
    }
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccount.name
        }
        {
          name: 'AzureWebJobsSecretStorageType'
          value: 'Files'  // Required for Container Apps with identity-based storage
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
      ]
    }
  }
}
```

## Why This Is Needed

- Identity-based storage URIs (e.g., `AzureWebJobsStorage__blobServiceUri`) work for runtime operations
- However, Functions' internal secret/key management requires either:
  - A full connection string with account keys
  - A SAS URI
  - File-based secret storage (recommended for Container Apps)
- File-based secrets are the correct, secure approach for Container Apps deployments

## Common Error Without This Setting

```
System.InvalidOperationException: Secret initialization from Blob storage failed due to missing both
an Azure Storage connection string and a SAS connection uri.
```

## When to Use This Configuration

- Deploying Azure Functions to Container Apps
- Using .NET Aspire with `AddAzureFunctionsProject` and `WithHostStorage`
- Using identity-based storage access (no connection strings)
- Setting environment variables like `AzureWebJobsStorage__accountName` or `AzureWebJobsStorage__blobServiceUri`
