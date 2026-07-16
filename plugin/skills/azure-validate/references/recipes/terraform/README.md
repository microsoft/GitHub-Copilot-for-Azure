# Terraform Validation

Validation steps for Terraform deployments.

## Prerequisites

- `./infra/main.tf` exists
- State backend accessible

## Run the preflight script

Run the pre-built validation script instead of executing each check by hand. It runs
the full deterministic preflight sequence in one call and prints a compact
**PASS / FAIL / SKIP** summary plus the captured error text for any failed step, so you
can jump straight to remediation without re-parsing raw command output.

| Script | Purpose |
|--------|---------|
| [`scripts/validate-terraform.sh`](scripts/validate-terraform.sh) | Bash preflight runner |
| [`scripts/validate-terraform.ps1`](scripts/validate-terraform.ps1) | PowerShell preflight runner |

The script runs, in order: Terraform installed → Azure CLI installed → authenticated
(`az account show`) → `terraform init` → `terraform fmt -check` → `terraform validate` →
`terraform plan` → `terraform state list` → Go-style `{{ .Env.* }}` template-variable scan.
It runs **every** check even if an earlier one fails, and exits non-zero when any step fails.

**Usage:**

```bash
./scripts/validate-terraform.sh [infra-dir] [subscription-id]   # infra-dir defaults to ./infra
```
```powershell
.\scripts\validate-terraform.ps1 [-InfraDir <path>] [-SubscriptionId <id>]
```

**Examples:**

```bash
./scripts/validate-terraform.sh                 # validate ./infra
./scripts/validate-terraform.sh ./infra 00000000-0000-0000-0000-000000000000
```
```powershell
.\scripts\validate-terraform.ps1 -InfraDir ./infra
```

**Reading the output:** the summary table lists every step with `PASS`, `FAIL`, or `SKIP`
(a step is skipped when a prerequisite such as Terraform or the infra directory is missing).
For each `FAIL`, a **FAILURE DETAILS** section prints the captured error text. Use the
remediation guidance below to fix failed steps, then re-run the script.

## Remediation

The script only **runs and reports** — fixing failures is manual. Guidance per step:

### Terraform / Azure CLI not installed

- Terraform: see https://developer.hashicorp.com/terraform/install
- Azure CLI: `mcp_azure_mcp_extension_cli_install(cli-type: "az")`

### Not authenticated

```bash
az login
az account set --subscription <subscription-id>
```

### Format check failed

```bash
terraform fmt -recursive
```

### Validate / plan / state failures

Read the captured error text in the script output, then consult
[Error handling](./errors.md).

### Azure Policy Validation

The script does not cover policy checks. See
[Policy Validation Guide](../../policy-validation.md) for retrieving and validating Azure
policies for your subscription.

### Template Variable Resolution (AZD+Terraform)

> ⚠️ **CRITICAL for azd+Terraform projects.** azd substitutes `${VAR}` references in
> `main.tfvars.json` via envsubst, but does NOT interpolate Go-style template variables
> (`{{ .Env.* }}`). Unresolved Go-style template strings passed to Terraform cause
> cascading deployment failures, state conflicts, and timeouts.

When the template-variable scan reports `FAIL`:

1. **Fix the syntax** in `main.tfvars.json` — replace `{{ .Env.VAR }}` with `${VAR}`:
   ```json
   {
       "environment_name": "${AZURE_ENV_NAME}",
       "location": "${AZURE_LOCATION}"
   }
   ```
2. For additional variables, use **`TF_VAR_*` environment variables**:
   ```bash
   azd env set TF_VAR_environment_name "$(azd env get-value AZURE_ENV_NAME)"
   ```
3. **Verify** that `variables.tf` declares all required variables.
4. **Re-run** the script to confirm `terraform validate` / `plan` and the scan now pass.

> Prefer putting static defaults in `variables.tf` `default` values. Using `terraform.tfvars`
> (HCL) for static defaults is acceptable if your team prefers it; this restriction is
> specifically about avoiding Go-style template expressions in `.tfvars.json` files.

## References

- [Error handling](./errors.md)

## Next

All checks pass → **azure-deploy**
