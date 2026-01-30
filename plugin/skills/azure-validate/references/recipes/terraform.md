# Terraform Recipe: Validate

Guide for validating Terraform infrastructure before deployment.

## Overview

This recipe covers validation for Terraform configurations targeting Azure.

## When to Use

- Terraform-based infrastructure
- Using AzureRM provider
- State backend configured

## Validation Sequence

### Step 1: Initialize Terraform

Download providers and initialize backend:

```bash
cd infra
terraform init
```

**Success:**
```
Terraform has been successfully initialized!
```

**Common issues:**
- Backend storage not accessible
- Provider version conflicts

### Step 2: Format Check

Verify code formatting:

```bash
terraform fmt -check -recursive
```

**Success:** No output (properly formatted)

**Fix formatting:**
```bash
terraform fmt -recursive
```

### Step 3: Validate Syntax

Validate configuration syntax:

```bash
terraform validate
```

**Success:**
```
Success! The configuration is valid.
```

### Step 4: Plan Preview

Generate execution plan:

```bash
terraform plan -out=tfplan
```

**Expected output:**
```
Terraform will perform the following actions:

  # azurerm_resource_group.main will be created
  + resource "azurerm_resource_group" "main" {
      + id       = (known after apply)
      + location = "eastus"
      + name     = "rg-dev"
    }

Plan: 5 to add, 0 to change, 0 to destroy.
```

### Step 5: Authentication Check

Verify Azure authentication:

```bash
# Using Azure CLI auth
az account show

# Or check Terraform Azure login
terraform providers
```

### Step 6: State Backend Check

Verify state backend is accessible:

```bash
# List state resources
terraform state list
```

If new project, this will be empty.

## Common Errors

### Provider Not Found

```
Error: Failed to query available provider packages
```

**Fix:** Run `terraform init`

### Backend Access Denied

```
Error: Failed to get existing workspaces: storage: access denied
```

**Fix:** Check storage account permissions, run `az login`

### Resource Already Exists

```
Error: A resource with the ID already exists
```

**Fix:** Import existing resource or remove from state

### Variable Not Set

```
Error: No value for required variable
```

**Fix:** Add to terraform.tfvars or pass via -var flag

## Validation Checklist

| Check | Command | Required |
|-------|---------|----------|
| Initialize | `terraform init` | ✅ |
| Format | `terraform fmt -check` | ⚠️ Warning |
| Validate | `terraform validate` | ✅ |
| Plan | `terraform plan` | ✅ |
| Authentication | `az account show` | ✅ |

## State Management Validation

If using workspaces:

```bash
# List workspaces
terraform workspace list

# Select workspace
terraform workspace select dev
```

## Security Validation

Check for sensitive data exposure:

```bash
# Review plan for sensitive values
terraform plan -out=tfplan
terraform show -json tfplan | jq '.planned_values.outputs'
```

Ensure sensitive outputs are marked:

```hcl
output "database_password" {
  value     = azurerm_sql_database.main.administrator_login_password
  sensitive = true
}
```

## Recording Results

Update Preparation Manifest:

```markdown
## Validation Requirements

### Pre-Deployment Checks

| Check | Required | Status |
|-------|----------|--------|
| terraform init | ✅ | Pass |
| terraform validate | ✅ | Pass |
| terraform plan | ✅ | Pass |
| Azure authentication | ✅ | Pass |
| State backend | ✅ | Pass |
```

## Next Steps

After all validations pass:

1. Update manifest status to `Validated`
2. Proceed to `azure-deploy` skill with Terraform recipe
3. Run `terraform apply`
