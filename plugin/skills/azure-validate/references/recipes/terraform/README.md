# Terraform Validation

Validation steps for Terraform deployments.

## Prerequisites

- `./infra/main.tf` exists
- State backend accessible

## Validation Steps

- [ ] 1. Terraform Installation
- [ ] 2. Azure CLI Installation
- [ ] 3. Authentication
- [ ] 4. Initialize
- [ ] 5. Format Check
- [ ] 6. Validate Syntax
- [ ] 7. Plan Preview
- [ ] 8. State Backend
- [ ] 9. Azure Policy Validation
- [ ] 10. Template Variable Resolution Check (AZD+Terraform)

## Validation Details

### 1. Terraform Installation

Verify Terraform is installed:

```bash
terraform version
```

**If not installed:** See https://developer.hashicorp.com/terraform/install

### 2. Azure CLI Installation

Verify Azure CLI is installed:

```bash
az version
```

**If not installed:**
```
mcp_azure_mcp_extension_cli_install(cli-type: "az")
```

### 3. Authentication

```bash
az account show
```

**If not logged in:**
```bash
az login
az account set --subscription <subscription-id>
```

### 4. Initialize

```bash
cd infra
terraform init
```

### 5. Format Check

```bash
terraform fmt -check -recursive
```

**Fix if needed:**
```bash
terraform fmt -recursive
```

### 6. Validate Syntax

```bash
terraform validate
```

### 7. Plan Preview

```bash
terraform plan -out=tfplan
```

### 8. State Backend

Verify state is accessible:

```bash
terraform state list
```

### 9. Azure Policy Validation

See [Policy Validation Guide](../../policy-validation.md) for instructions on retrieving and validating Azure policies for your subscription.

### 10. Template Variable Resolution Check (AZD+Terraform)

> ⚠️ **CRITICAL for azd+Terraform projects.** azd does NOT interpolate Go-style template variables
> (`{{ .Env.* }}`) in `.tfvars.json` files. Unresolved template strings passed to Terraform cause
> cascading deployment failures, state conflicts, and timeouts.

**Check for unresolved template variables:**

```bash
# Check for Go-style template variables in Terraform files
grep -rn '{{ *\.Env\.' infra/ || echo "OK: No template variables found"

# Check for any .tfvars.json files (should not exist in azd+Terraform projects)
find infra/ -name "*.tfvars.json" -exec echo "WARNING: Found {}" \;
```

**If template variables are found:**
1. **Remove** any `main.tfvars.json` file from `infra/`
2. **Replace** template variable references with `TF_VAR_*` environment variables:
   ```bash
   azd env set TF_VAR_environment_name "$(azd env get-value AZURE_ENV_NAME)"
   ```
3. **Verify** that `variables.tf` declares all required variables so azd can auto-map them
4. **Re-run** `terraform validate` and `terraform plan` to confirm

**If `.tfvars.json` file is found:**
- For azd+Terraform projects, variable passing is handled by azd environment → Terraform variable auto-mapping
- Remove the `.tfvars.json` file and rely on `azd env set` or `TF_VAR_*` environment variables
- Prefer putting static defaults in `variables.tf` `default` values. Using `terraform.tfvars` (HCL) for static defaults is acceptable if your team prefers it; this restriction is specifically about avoiding `.tfvars.json` files and Go-style template expressions.

## References

- [Error handling](./errors.md)

## Next

All checks pass → **azure-deploy**
