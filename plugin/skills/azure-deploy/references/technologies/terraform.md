# Terraform Deployment

Deploy using Terraform for infrastructure management.

## Overview

Use Terraform when:
- Team prefers Terraform over Bicep
- Multi-cloud deployment requirements
- Existing Terraform infrastructure
- State management requirements

## Prerequisites

| Requirement | Check Command |
|-------------|---------------|
| Terraform installed | `terraform version` |
| Azure CLI authenticated | `az account show` |
| Provider configured | Check `provider "azurerm"` block |

## Project Structure

```
infra/
├── main.tf           # Main configuration
├── variables.tf      # Variable definitions
├── outputs.tf        # Output values
├── terraform.tfvars  # Variable values
└── backend.tf        # State backend config
```

## Deployment Commands

### Initialize

Download providers and initialize backend:

```bash
cd infra
terraform init
```

### Plan

Preview changes:

```bash
terraform plan -out=tfplan
```

### Apply

Deploy infrastructure:

```bash
terraform apply tfplan
# Or auto-approve
terraform apply -auto-approve
```

## Azure Provider Configuration

```hcl
# backend.tf
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "tfstatexxxxx"
    container_name       = "tfstate"
    key                  = "myapp.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}
```

## Variables

### variables.tf

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}
```

### terraform.tfvars

```hcl
environment = "dev"
location    = "eastus"
```

### Command Line Override

```bash
terraform apply -var="environment=prod" -var="location=westus2"
```

## State Management

### Remote State (Recommended)

Store state in Azure Storage:

```bash
# Create storage account for state
az group create --name rg-terraform-state --location eastus
az storage account create --name tfstatexxxxx --resource-group rg-terraform-state
az storage container create --name tfstate --account-name tfstatexxxxx
```

### State Commands

```bash
terraform state list          # List resources
terraform state show <addr>   # Show resource details
terraform state rm <addr>     # Remove from state (not destroy)
```

## Workspaces

Manage multiple environments:

```bash
terraform workspace new dev
terraform workspace new prod
terraform workspace select dev
terraform workspace list
```

## Outputs

### outputs.tf

```hcl
output "api_url" {
  value = azurerm_container_app.api.latest_revision_fqdn
}

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}
```

### Get Outputs

```bash
terraform output
terraform output -json
terraform output api_url
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
    command: 'init'
    workingDirectory: '$(System.DefaultWorkingDirectory)/infra'

- task: TerraformTaskV4@4
  inputs:
    provider: 'azurerm'
    command: 'apply'
    workingDirectory: '$(System.DefaultWorkingDirectory)/infra'
    commandOptions: '-auto-approve'
```

## Error Handling

| Error | Resolution |
|-------|------------|
| `Provider not found` | Run `terraform init` |
| `Backend init failed` | Check storage account permissions |
| `Resource already exists` | Import with `terraform import` |
| `State lock error` | Check for concurrent runs, force unlock if needed |

## Cleanup

Destroy all resources:

```bash
terraform destroy -auto-approve
```

⚠️ This is destructive and permanent.
