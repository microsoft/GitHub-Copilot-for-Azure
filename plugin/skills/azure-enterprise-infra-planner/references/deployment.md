# Deployment Execution

Execute infrastructure deployment after plan approval and IaC generation.

## Status Gate

**Before executing any deployment command, verify:**

```txt
meta.status === "approved"
```

If status is not `approved`, **STOP** and inform the user. Do NOT manually change the status.

## Pre-Deployment Checklist

1. **Plan approved** — `meta.status` is `approved`
2. **IaC generated** — Bicep or Terraform files exist in `<project-root>/infra/`
3. **Azure context confirmed** — Subscription and resource group selected
4. **User confirmation** — Explicit "yes, deploy" from the user
5. **Syntax validated** — `az bicep build` or `terraform validate` passed

## Bicep Deployment

```bash
# Validate first
az bicep build --file infra/main.bicep

# Deploy
az deployment group create \
  --resource-group <resource-group-name> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --name <deployment-name>
```

PowerShell:
```powershell
az deployment group create `
  --resource-group <resource-group-name> `
  --template-file infra/main.bicep `
  --parameters infra/main.bicepparam `
  --name <deployment-name>
```

### What-If Preview

Run `--what-if` before actual deployment to preview changes:

```bash
az deployment group create \
  --resource-group <resource-group-name> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --what-if
```

## Terraform Deployment

```bash
cd infra

# Initialize
terraform init

# Preview changes
terraform plan -var-file=prod.tfvars -out=tfplan

# Apply (requires confirmation)
terraform apply tfplan
```

PowerShell:
```powershell
Set-Location infra
terraform init
terraform plan -var-file=prod.tfvars -out=tfplan
terraform apply tfplan
```

## Post-Deployment

After successful deployment:

1. **Update status** — Set `meta.status` to `deployed` in `<project-root>/.azure/infrastructure-plan.json`
2. **Verify resources** — List resources in the target resource group using Azure CLI: `az resource list -g <resource-group-name> -o table`
3. **Report to user** — List deployed resources, endpoints, and any follow-up actions

## Error Handling

| Error | Action |
|-------|--------|
| Authentication failure | Run `az login` and retry |
| Quota exceeded | Check limits with `mcp_azure_mcp_quota`, select different SKU or region |
| Name conflict | Resource name already taken; append unique suffix or choose new name |
| Region unavailable | Service not available in chosen region; select alternative |
| Validation failure | Fix IaC syntax errors before retrying deployment |
