# Table Storage Recipe

Table Storage integration for Azure Functions using managed identity.

## Template Selection

Use `http` as the base template, then compose this recipe when the function app uses Table Storage.

**Detection indicators**:
- `TableServiceClient`
- `TableClient`
- `Azure.Data.Tables`
- `@azure/data-tables`

## Required RBAC

The HTTP base template grants `Storage Blob Data Owner` for runtime and package deployment.  
When using Table Storage, add `Storage Table Data Contributor` for the function identity.

```bicep
resource tableRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, functionApp.id, 'Storage Table Data Contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Troubleshooting

### 500 / Unauthorized when accessing tables

**Cause:** `Storage Table Data Contributor` role is missing or still propagating.  
**Fix:** Add the role assignment at the storage account scope and wait 30-60 seconds before retrying.
