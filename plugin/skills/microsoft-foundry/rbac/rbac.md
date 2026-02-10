# Microsoft Foundry RBAC Management

This reference provides guidance for managing Role-Based Access Control (RBAC) for Microsoft Foundry resources, including user permissions, managed identity configuration, and service principal setup for CI/CD pipelines.

## Quick Reference

| Property | Value |
|----------|-------|
| **CLI Extension** | `az role assignment`, `az ad sp` |
| **Resource Type** | `Microsoft.CognitiveServices/accounts` |
| **Best For** | Permission management, access auditing, CI/CD setup |

## When to Use

Use this reference when the user wants to:

- **Grant user access** to Foundry resources or projects
- **Set up developer permissions** (Project Manager, Owner roles)
- **Audit role assignments** to see who has access
- **Validate permissions** to check if actions are allowed
- **Configure managed identity roles** for connected resources
- **Create service principals** for CI/CD pipeline automation
- **Troubleshoot permission errors** with Foundry resources

## Azure AI Foundry Built-in Roles

Azure AI Foundry introduces **four new built-in roles** specifically for the Foundry Developer Platform (FDP) model:

| Role | Create Projects | Data Actions | Role Assignments |
|------|-----------------|--------------|------------------|
| **Azure AI User** | ❌ | ✅ | ❌ |
| **Azure AI Project Manager** | ✅ | ✅ | ✅ (AI User only) |
| **Azure AI Account Owner** | ✅ | ❌ | ✅ (AI User only) |
| **Azure AI Owner** | ✅ | ✅ | ✅ |

> ⚠️ **Warning:** The Azure AI User role is auto-assigned via the Azure Portal but NOT via SDK/CLI deployments. Automation must explicitly assign roles.

## Workflows

### 1. Setup User Permissions

Grant a user access to your Foundry project with the Azure AI User role.

**Command Pattern:** "Grant Alice access to my Foundry project"

```bash
# Assign Azure AI User role to a user
az role assignment create \
  --role "Azure AI User" \
  --assignee "<user-email-or-object-id>" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>"

# Assign at project level (more restrictive)
az role assignment create \
  --role "Azure AI User" \
  --assignee "<user-email-or-object-id>" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>/projects/<project-name>"

# Verify the assignment
az role assignment list \
  --assignee "<user-email-or-object-id>" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --output table
```

### 2. Setup Developer Permissions

Make a user a project manager with the ability to create projects and assign Azure AI User roles.

**Command Pattern:** "Make Bob a project manager"

```bash
# Assign Azure AI Project Manager role
az role assignment create \
  --role "Azure AI Project Manager" \
  --assignee "<user-email-or-object-id>" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>"

# For full ownership including data actions
az role assignment create \
  --role "Azure AI Owner" \
  --assignee "<user-email-or-object-id>" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>"

# Verify the assignment
az role assignment list \
  --assignee "<user-email-or-object-id>" \
  --all \
  --query "[?contains(scope, '<foundry-resource-name>')].{Role:roleDefinitionName, Scope:scope}" \
  --output table
```

### 3. Audit Role Assignments

List all role assignments on your Foundry resource to understand who has access.

**Command Pattern:** "Who has access to my Foundry?"

```bash
# List all role assignments on the Foundry resource
az role assignment list \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --output table

# List with detailed information including principal names
az role assignment list \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --query "[].{Principal:principalName, PrincipalType:principalType, Role:roleDefinitionName, Scope:scope}" \
  --output table

# List only Azure AI specific roles
az role assignment list \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --query "[?contains(roleDefinitionName, 'Azure AI')].{Principal:principalName, Role:roleDefinitionName}" \
  --output table

# Include inherited assignments from resource group and subscription
az role assignment list \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --include-inherited \
  --output table
```

### 4. Validate Permissions

Check if a user (or yourself) has the required permissions to perform specific actions.

**Command Pattern:** "Can I deploy models?"

```bash
# Check current user's effective permissions on the resource
az role assignment list \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --query "[].roleDefinitionName" \
  --output tsv

# List all permissions for the current user (including inherited)
az role assignment list \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" \
  --all \
  --query "[?contains(scope, '<foundry-resource-name>') || contains(scope, '<resource-group>')].{Role:roleDefinitionName, Scope:scope}" \
  --output table

# Check specific permission actions available to a role
az role definition list \
  --name "Azure AI User" \
  --query "[].permissions[].actions" \
  --output json

# Validate a specific user's permissions
az role assignment list \
  --assignee "<user-email-or-object-id>" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --query "[].{Role:roleDefinitionName, Actions:description}" \
  --output table
```

**Permission Requirements by Action:**

| Action | Required Role(s) |
|--------|------------------|
| Deploy models | Azure AI User, Azure AI Project Manager, Azure AI Owner |
| Create projects | Azure AI Project Manager, Azure AI Account Owner, Azure AI Owner |
| Assign Azure AI User role | Azure AI Project Manager, Azure AI Account Owner, Azure AI Owner |
| Full data access | Azure AI User, Azure AI Project Manager, Azure AI Owner |

### 5. Configure Managed Identity Roles

Set up roles for the project's managed identity to access connected resources like Storage, AI Search, and Key Vault.

**Command Pattern:** "Set up identity for my project"

```bash
# Get the managed identity principal ID of the Foundry resource
PRINCIPAL_ID=$(az cognitiveservices account show \
  --name <foundry-resource-name> \
  --resource-group <resource-group> \
  --query identity.principalId \
  --output tsv)

# Assign Storage Blob Data Reader for accessing storage
az role assignment create \
  --role "Storage Blob Data Reader" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Storage/storageAccounts/<storage-account-name>"

# Assign Storage Blob Data Contributor for read/write access
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Storage/storageAccounts/<storage-account-name>"

# Assign Key Vault Secrets User for accessing secrets
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.KeyVault/vaults/<key-vault-name>"

# Assign Search Index Data Reader for AI Search
az role assignment create \
  --role "Search Index Data Reader" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Search/searchServices/<search-service-name>"

# Assign Search Index Data Contributor for read/write on AI Search
az role assignment create \
  --role "Search Index Data Contributor" \
  --assignee "$PRINCIPAL_ID" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Search/searchServices/<search-service-name>"

# Verify all managed identity role assignments
az role assignment list \
  --assignee "$PRINCIPAL_ID" \
  --all \
  --output table
```

**Common Managed Identity Role Assignments:**

| Connected Resource | Role | Purpose |
|--------------------|------|---------|
| Azure Storage | Storage Blob Data Reader | Read files/documents |
| Azure Storage | Storage Blob Data Contributor | Read/write files |
| Azure Key Vault | Key Vault Secrets User | Read secrets |
| Azure AI Search | Search Index Data Reader | Query indexes |
| Azure AI Search | Search Index Data Contributor | Query and modify indexes |
| Azure Cosmos DB | Cosmos DB Account Reader | Read data |

### 6. Create Service Principal for CI/CD

Create a service principal with minimal required roles for CI/CD pipeline automation.

**Command Pattern:** "Create SP for CI/CD pipeline"

```bash
# Create a service principal for CI/CD
az ad sp create-for-rbac \
  --name "foundry-cicd-sp" \
  --role "Azure AI User" \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --output json

# Save the output credentials securely - contains:
# - appId (client ID)
# - password (client secret)
# - tenant (tenant ID)

# For deployments that need to create/manage resources, use Azure AI Project Manager
az ad sp create-for-rbac \
  --name "foundry-cicd-admin-sp" \
  --role "Azure AI Project Manager" \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<foundry-resource-name>" \
  --output json

# Add additional role for resource group operations (if needed for provisioning)
SP_APP_ID=$(az ad sp list --display-name "foundry-cicd-sp" --query "[0].appId" -o tsv)
az role assignment create \
  --role "Contributor" \
  --assignee "$SP_APP_ID" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<resource-group>"

# List service principal role assignments
az role assignment list \
  --assignee "$SP_APP_ID" \
  --all \
  --output table

# Reset credentials if needed
az ad sp credential reset \
  --id "$SP_APP_ID" \
  --output json
```

**CI/CD Service Principal Best Practices:**

> 💡 **Tip:** Use the principle of least privilege - start with `Azure AI User` and only add more roles as needed.

| CI/CD Scenario | Recommended Role | Additional Roles |
|----------------|------------------|------------------|
| Deploy models only | Azure AI User | None |
| Manage projects | Azure AI Project Manager | None |
| Full provisioning | Azure AI Owner | Contributor (on RG) |
| Read-only monitoring | Reader | Azure AI User (for data) |

**Using Service Principal in CI/CD Pipeline:**

```bash
# Login with service principal in CI/CD
az login --service-principal \
  --username "<app-id>" \
  --password "<client-secret>" \
  --tenant "<tenant-id>"

# Set subscription context
az account set --subscription "<subscription-id>"

# Now run Foundry commands...
```

## Error Handling

| Issue | Cause | Resolution |
|-------|-------|------------|
| "Authorization failed" when deploying | Missing Azure AI User role | Assign Azure AI User role at resource scope |
| Cannot create projects | Missing Project Manager or Owner role | Assign Azure AI Project Manager role |
| "Access denied" on connected resources | Managed identity missing roles | Assign appropriate roles to MI on each resource |
| Portal works but CLI fails | Portal auto-assigns roles, CLI doesn't | Explicitly assign Azure AI User via CLI |
| Service principal cannot access data | Wrong role or scope | Verify Azure AI User is assigned at correct scope |
| "Principal does not exist" | User/SP not found in directory | Verify the assignee email or object ID is correct |
| Role assignment already exists | Duplicate assignment attempt | Use `az role assignment list` to verify existing assignments |

## Additional Resources

- [Azure AI Foundry RBAC Documentation](https://learn.microsoft.com/azure/ai-foundry/concepts/rbac-ai-foundry)
- [Azure Built-in Roles](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles)
- [Managed Identities Overview](https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview)
- [Service Principal Authentication](https://learn.microsoft.com/azure/developer/github/connect-from-azure)
