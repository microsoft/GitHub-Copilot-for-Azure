# Bicep Recipe: Validate

Guide for validating standalone Bicep infrastructure before deployment.

## Overview

This recipe covers validation for Bicep templates deployed with Azure CLI (without AZD).

## When to Use

- No azure.yaml in project
- Direct `az deployment` workflow
- Standalone Bicep infrastructure

## Validation Sequence

### Step 1: Bicep Compilation

Compile Bicep to verify syntax:

```bash
az bicep build --file ./infra/main.bicep
```

**Success:** No output (compiles cleanly)

**Failure:** Shows line numbers and error messages

### Step 2: Template Validation

Validate against Azure:

```bash
# Subscription-level deployment
az deployment sub validate \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json \
  --parameters environmentName=dev

# Resource group deployment
az deployment group validate \
  --resource-group rg-myapp-dev \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

### Step 3: What-If Preview

Preview changes without deploying:

```bash
# Subscription-level
az deployment sub what-if \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json \
  --parameters environmentName=dev

# Resource group
az deployment group what-if \
  --resource-group rg-myapp-dev \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

**Expected output:**
```
Resource and property changes are indicated with these symbols:
  + Create
  ~ Modify
  - Delete

The deployment will update the following scope:

Scope: /subscriptions/xxxx-xxxx/resourceGroups/rg-myapp-dev

  + Microsoft.App/containerApps/myapp-api-xxxxx
  + Microsoft.Insights/components/myapp-appi-xxxxx
  + Microsoft.KeyVault/vaults/myapp-kv-xxxxx
```

### Step 4: Authentication Check

Verify Azure CLI authentication:

```bash
# Check logged in
az account show

# Verify subscription
az account set --subscription <subscription-id>
```

### Step 5: Permission Check

Verify deployment permissions:

```bash
# List role assignments
az role assignment list \
  --assignee $(az ad signed-in-user show --query id -o tsv) \
  --query "[].roleDefinitionName" -o tsv
```

**Required:** Contributor role (minimum)

## Common Errors

### BCP035: Invalid Type

```
Error BCP035: The specified "Microsoft.App/containerApps@2023-05-01" type is not valid
```

**Fix:** Check resource type name and API version

### Module Not Found

```
Error: Unable to find module './modules/webapp.bicep'
```

**Fix:** Verify module path is relative to main.bicep

### Parameter Missing

```
Error: The template parameter 'environmentName' was not provided
```

**Fix:** Add parameter to command or parameters file

## Validation Checklist

| Check | Command | Required |
|-------|---------|----------|
| Bicep syntax | `az bicep build` | ✅ |
| Template validation | `az deployment sub validate` | ✅ |
| What-if preview | `az deployment sub what-if` | ✅ |
| Authentication | `az account show` | ✅ |
| Permissions | `az role assignment list` | ✅ |

## Recording Results

Update Preparation Manifest:

```markdown
## Validation Requirements

### Pre-Deployment Checks

| Check | Required | Status |
|-------|----------|--------|
| Bicep compilation | ✅ | Pass |
| Template validation | ✅ | Pass |
| What-if preview | ✅ | Pass |
| Azure CLI auth | ✅ | Pass |
| Permissions | ✅ | Pass |
```

## Next Steps

After all validations pass:

1. Update manifest status to `Validated`
2. Proceed to `azure-deploy` skill with Azure CLI recipe
3. Run `az deployment sub create`
