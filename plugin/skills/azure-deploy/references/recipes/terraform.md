# Terraform Recipe: Deploy

Guide for deploying to Azure using Terraform.

## Overview

This recipe covers deployment using Terraform for Azure infrastructure.

## When to Use

- Terraform-based infrastructure
- State management requirements
- Multi-cloud scenarios
- Team prefers Terraform

## Prerequisites

Before deploying:

1. **Preparation Manifest** exists with status `Validated`
2. **Terraform initialized** (`terraform init`)
3. **Plan validated** (`terraform plan`)
4. **State backend** configured and accessible

## Deployment Commands

### Apply with Plan File (Recommended)

```bash
cd infra

# Generate plan
terraform plan -out=tfplan

# Apply plan
terraform apply tfplan
```

### Auto-Approve Apply

For CI/CD pipelines:

```bash
terraform apply -auto-approve
```

### Apply with Variables

```bash
terraform apply \
  -var="environment=prod" \
  -var="location=westus2" \
  -auto-approve
```

### Apply Specific Target

Deploy specific resource:

```bash
terraform apply -target=azurerm_container_app.api
```

## Workspace Management

### Create Workspace

```bash
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod
```

### Switch Workspace

```bash
terraform workspace select prod
```

### Deploy to Specific Workspace

```bash
terraform workspace select prod
terraform apply -auto-approve
```

## Get Outputs

```bash
# All outputs
terraform output

# JSON format
terraform output -json

# Specific output
terraform output api_url
```

## Application Deployment

After infrastructure is deployed, deploy application code:

### Get Resource Values

```bash
# Get ACR name
ACR_NAME=$(terraform output -raw acr_name)

# Get App name
APP_NAME=$(terraform output -raw container_app_name)
```

### Deploy Container

```bash
# Build and push
az acr build --registry $ACR_NAME --image myapp:latest ./src/api

# Update app (if using AzureRM Container App)
az containerapp update \
  --name $APP_NAME \
  --resource-group $(terraform output -raw resource_group_name) \
  --image $ACR_NAME.azurecr.io/myapp:latest
```

## Error Handling

### Common Errors

| Error | Resolution |
|-------|------------|
| `State lock error` | Wait for other operation or force unlock |
| `Resource already exists` | Import with `terraform import` |
| `Backend access denied` | Check storage permissions |
| `Provider error` | Run `terraform init -upgrade` |

### Force Unlock State

```bash
terraform force-unlock <lock-id>
```

⚠️ Use with caution—ensure no other operations running.

### Import Existing Resource

```bash
terraform import azurerm_resource_group.main /subscriptions/.../resourceGroups/rg-myapp
```

## Recording Outcomes

Update Preparation Manifest:

```markdown
## Deployment Status

| Environment | Status | Timestamp | Workspace |
|-------------|--------|-----------|-----------|
| dev | ✅ Deployed | 2026-01-29T14:30:00Z | dev |

### Deployed Resources

| Resource | Type | Name |
|----------|------|------|
| Resource Group | rg | rg-myapp-dev |
| Container App | ca | myapp-api-xxxxx |

### Terraform State

| Backend | Path |
|---------|------|
| Azure Storage | tfstatexxxxx/tfstate/myapp.terraform.tfstate |
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Setup Terraform
  uses: hashicorp/setup-terraform@v3

- name: Azure Login
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Terraform Init
  run: terraform init
  working-directory: ./infra

- name: Terraform Apply
  run: terraform apply -auto-approve
  working-directory: ./infra
  env:
    TF_VAR_environment: ${{ vars.ENVIRONMENT }}
```

### Azure DevOps

```yaml
- task: TerraformInstaller@1
  inputs:
    terraformVersion: 'latest'

- task: TerraformTaskV4@4
  inputs:
    provider: 'azurerm'
    command: 'apply'
    workingDirectory: '$(System.DefaultWorkingDirectory)/infra'
    commandOptions: '-auto-approve'
    environmentServiceNameAzureRM: 'azure-connection'
```

## Cleanup (DESTRUCTIVE)

Destroy all resources:

```bash
terraform destroy -auto-approve
```

⚠️ This is permanent and cannot be undone.

### Selective Destroy

```bash
terraform destroy -target=azurerm_container_app.api
```
