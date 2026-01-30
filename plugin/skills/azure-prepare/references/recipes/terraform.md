# Terraform Recipe: Prepare

Guide for preparing an application for Azure deployment using Terraform.

## Overview

This recipe covers preparing infrastructure-as-code with Terraform for Azure deployment.

## When to Use

- Team prefers Terraform over Bicep
- Multi-cloud requirements
- Existing Terraform expertise
- State management requirements

## MCP Tool

Get Terraform best practices:

```
mcp_azure_mcp_azureterraformbestpractices(intent: "get terraform best practices for Azure deployment")
```

## Workflow Phases

### Phase 1: Discovery

Same as other recipes—analyze application components and dependencies.

### Phase 2: Architecture Planning

Map components to Azure resources using Terraform resource types:

| Component Type | Terraform Resource |
|----------------|-------------------|
| Resource Group | `azurerm_resource_group` |
| Container App | `azurerm_container_app` |
| App Service | `azurerm_linux_web_app` |
| Functions | `azurerm_linux_function_app` |
| Cosmos DB | `azurerm_cosmosdb_account` |
| SQL Database | `azurerm_mssql_database` |

### Phase 3: Infrastructure Generation

Create Terraform structure:

```
infra/
├── main.tf                 # Main configuration
├── variables.tf            # Variable definitions
├── outputs.tf              # Output values
├── terraform.tfvars        # Variable values
├── backend.tf              # State backend
└── modules/
    ├── webapp/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── database/
        └── ...
```

#### Provider Configuration

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

#### Main Configuration

```hcl
# main.tf
resource "azurerm_resource_group" "main" {
  name     = "rg-${var.environment}"
  location = var.location
}

module "webapp" {
  source              = "./modules/webapp"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  environment         = var.environment
}
```

### Phase 4: State Backend Setup

Create Azure storage for Terraform state:

```bash
# Create resource group
az group create --name rg-terraform-state --location eastus

# Create storage account
az storage account create \
  --name tfstatexxxxx \
  --resource-group rg-terraform-state \
  --sku Standard_LRS

# Create container
az storage container create \
  --name tfstate \
  --account-name tfstatexxxxx
```

### Phase 5: Manifest Creation

Create Preparation Manifest documenting:

```markdown
## Implementation Plan

### Deployment Technology

- **Primary**: Terraform
- **State Backend**: Azure Storage
- **CI/CD**: GitHub Actions / Azure DevOps

### Deployment Commands

\`\`\`bash
cd infra
terraform init
terraform plan -out=tfplan
terraform apply tfplan
\`\`\`
```

## Output Artifacts

| Artifact | Location |
|----------|----------|
| Preparation Manifest | `.azure/preparation-manifest.md` |
| Terraform Config | `./infra/*.tf` |
| Modules | `./infra/modules/` |
| Variables | `./infra/terraform.tfvars` |

## Validation

```bash
cd infra

# Initialize
terraform init

# Validate syntax
terraform validate

# Plan (preview changes)
terraform plan
```

## Next Steps

After completing preparation:

1. Run `azure-validate` skill with Terraform recipe
2. Execute `terraform plan` to preview
3. Proceed to `azure-deploy` skill with Terraform recipe
