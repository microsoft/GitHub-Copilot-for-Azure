# Provision Preview

Validate infrastructure deployment with a preview (what-if) operation.

## TASK

Run `azd provision --preview` to verify infrastructure will deploy successfully without making changes.

## Command

```bash
azd provision --preview --no-prompt
```

## What It Validates

| Check | Description |
|-------|-------------|
| **Bicep compilation** | Templates compile without errors |
| **Resource naming** | Names are valid and available |
| **Resource conflicts** | No existing resource conflicts |
| **Permissions** | User has required permissions |
| **Quotas** | Subscription quotas not exceeded |
| **Dependencies** | Resource dependencies resolve correctly |

## Expected Output

Successful preview shows:

```
Previewing Azure resource changes

  Resource Group: rg-myapp-dev
    + Microsoft.App/managedEnvironments/myapp-env-xxxxx
    + Microsoft.App/containerApps/myapp-api-xxxxx
    + Microsoft.Insights/components/myapp-appi-xxxxx
    + Microsoft.OperationalInsights/workspaces/myapp-log-xxxxx
    + Microsoft.KeyVault/vaults/myapp-kv-xxxxx

Resources to create: 5
Resources to update: 0
Resources to delete: 0
```

## Common Errors and Resolutions

### Bicep Compilation Error

```
ERROR: /infra/main.bicep(45,3) : Error BCP035: The specified type is not valid
```

**Resolution**:
1. Check Bicep syntax at specified line
2. Verify resource type and API version
3. Run `az bicep build --file ./infra/main.bicep` for detailed errors

### Resource Name Already Exists

```
ERROR: The resource name 'myapp-kv' is already taken
```

**Resolution**:
1. Use unique naming with hash: `${prefix}-kv-${uniqueString(...)}`
2. Change the resource prefix
3. Use a different environment name

### Quota Exceeded

```
ERROR: Operation could not be completed as it results in exceeding approved quota
```

**Resolution**:
1. Request quota increase in Azure portal
2. Choose a different region
3. Use smaller SKU

### Permission Denied

```
ERROR: AuthorizationFailed: The client does not have authorization to perform action
```

**Resolution**:
1. Verify user has Contributor role
2. Check for deny assignments
3. Request access from subscription admin

### Invalid Location

```
ERROR: The location 'invalidregion' is not available for resource type
```

**Resolution**:
1. Choose a valid Azure region
2. Check resource availability in target region
```bash
az provider show --namespace Microsoft.App --query "resourceTypes[?resourceType=='containerApps'].locations" -o tsv
```

### Missing Parameter

```
ERROR: The template parameter 'environmentName' was not provided
```

**Resolution**:
1. Verify main.parameters.json has all required parameters
2. Check AZD environment variables are set
```bash
azd env get-values
```

### Module Not Found

```
ERROR: Unable to find module 'modules/containerapp.bicep'
```

**Resolution**:
1. Verify module file exists at specified path
2. Check relative path is correct from main.bicep

## Bicep Troubleshooting

### Compile Bicep Locally

```bash
az bicep build --file ./infra/main.bicep
```

### Validate Against Azure

```bash
az deployment sub validate \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json \
  --parameters environmentName=dev
```

### Check What-If Output

```bash
az deployment sub what-if \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json \
  --parameters environmentName=dev
```

## Validation Output

Record in manifest:

```markdown
### Provision Preview Results

| Check | Status | Details |
|-------|--------|---------|
| Bicep compilation | ✅ Pass | All templates compiled |
| Resource naming | ✅ Pass | All names available |
| Permissions | ✅ Pass | Contributor role verified |
| Quota check | ✅ Pass | Within limits |

### Planned Resources

| Resource | Type | Action |
|----------|------|--------|
| rg-myapp-dev | Resource Group | Create |
| myapp-env-xxxxx | Container Apps Environment | Create |
| myapp-api-xxxxx | Container App | Create |
| myapp-kv-xxxxx | Key Vault | Create |
```

## Pre-Provision Checks

Before running provision preview:

1. **Bicep installed and updated**
   ```bash
   az bicep upgrade
   ```

2. **Parameters file valid**
   ```bash
   cat ./infra/main.parameters.json
   ```

3. **Environment variables set**
   ```bash
   azd env get-value AZURE_LOCATION
   azd env get-value AZURE_ENV_NAME
   ```
