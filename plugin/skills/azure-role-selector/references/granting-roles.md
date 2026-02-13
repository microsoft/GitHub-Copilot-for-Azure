# Permissions Required to Grant RBAC Roles

When assigning RBAC roles to managed identities or users, you need specific permissions yourself.

## Required Permission

To grant any RBAC role to a System-Assigned Managed Identity, User-Assigned Managed Identity, or user, you need a role that includes the **`Microsoft.Authorization/roleAssignments/write`** permission.

## Common Roles with Assignment Permissions

| Role | Scope | Permissions | Least Privilege? |
|------|-------|-------------|------------------|
| **User Access Administrator** | Resource, Resource Group, or Subscription | Can assign roles but cannot access the data itself | ✅ Yes (for role assignment only) |
| **Owner** | Resource, Resource Group, or Subscription | Full access to all resources and can assign roles | ❌ No (grants more than needed) |
| **Custom Role** | Any scope | Specific permissions including `Microsoft.Authorization/roleAssignments/write` | ✅ Yes (if properly scoped) |

## Least Privilege Recommendation

For users who only need to assign roles to identities (e.g., granting Storage Blob Data Owner to a Web App's managed identity), the **User Access Administrator** role is the least privileged option.

### Example: Grant User Access Administrator at Storage Account Scope

```bash
# Get your subscription ID
# az account show --query id --output tsv

# Get the user's principal ID (object ID)
# az ad user show --id user@example.com --query id --output tsv

# Grant User Access Administrator to a user for a specific storage account
az role assignment create \
  --role "User Access Administrator" \
  --assignee USER_PRINCIPAL_ID \
  --scope /subscriptions/SUB_ID/resourceGroups/RG_NAME/providers/Microsoft.Storage/storageAccounts/STORAGE_ACCOUNT_NAME
```

### Example: Grant User Access Administrator at Resource Group Scope

```bash
# Grant User Access Administrator to a user for all resources in a resource group
az role assignment create \
  --role "User Access Administrator" \
  --assignee USER_PRINCIPAL_ID \
  --scope /subscriptions/SUB_ID/resourceGroups/RG_NAME
```

## Common Scenario: Web Apps and Functions Accessing Storage

When configuring a Web App or Function App to access Azure Storage using managed identity:

1. **Enable System-Assigned Managed Identity** on the Web App or Function App
2. **Assign Storage role** (e.g., Storage Blob Data Owner) to the managed identity
3. **User performing step 2** needs User Access Administrator or Owner on the Storage Account

### Full Example Workflow

```bash
# Step 1: Enable managed identity (requires Contributor on Web App)
PRINCIPAL_ID=$(az webapp identity assign \
  --name mywebapp \
  --resource-group myrg \
  --query principalId \
  --output tsv)

# Step 2: Grant Storage Blob Data Owner (requires User Access Administrator on Storage Account)
az role assignment create \
  --role "Storage Blob Data Owner" \
  --assignee $PRINCIPAL_ID \
  --scope /subscriptions/SUB_ID/resourceGroups/myrg/providers/Microsoft.Storage/storageAccounts/mystorageaccount
```

## Bicep: Role Assignment

To assign roles in Bicep, the deployment identity (service principal, managed identity, or user) must have **User Access Administrator** or **Owner** at the target scope.

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource webApp 'Microsoft.Web/sites@2022-09-01' existing = {
  name: webAppName
}

// Assign Storage Blob Data Owner role to the Web App's managed identity
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, webApp.id, 'Storage Blob Data Owner')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b') // Storage Blob Data Owner
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Custom Role with Assignment Permission

For organizations that want more granular control, create a custom role:

```json
{
  "Name": "Role Assignment Manager",
  "Description": "Can assign specific RBAC roles",
  "Actions": [
    "Microsoft.Authorization/roleAssignments/write",
    "Microsoft.Authorization/roleAssignments/read",
    "Microsoft.Authorization/roleDefinitions/read"
  ],
  "AssignableScopes": [
    "/subscriptions/SUB_ID"
  ]
}
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `AuthorizationFailed: The client does not have authorization to perform action 'Microsoft.Authorization/roleAssignments/write'` | Missing User Access Administrator or Owner role | Grant User Access Administrator at the target scope |
| `Insufficient privileges to complete the operation` | Attempting to assign a role at a scope where you lack permission | Grant User Access Administrator at or above the target scope |

## Portal UI

In the Azure Portal, when assigning roles via **Access Control (IAM)** → **Add role assignment**, the portal checks if you have `Microsoft.Authorization/roleAssignments/write` permission at that scope. If not, the "Add role assignment" button may be disabled or the operation will fail.

## Further Reading

- [Azure RBAC documentation](https://learn.microsoft.com/azure/role-based-access-control/overview)
- [User Access Administrator role](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#user-access-administrator)
- [Owner role](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#owner)
- [Assign Azure roles using Azure CLI](https://learn.microsoft.com/azure/role-based-access-control/role-assignments-cli)
