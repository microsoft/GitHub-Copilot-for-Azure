# Flex Consumption Terraform Pattern

**Use Flex Consumption for new deployments with managed identity (no connection strings).**

> **⚠️ IMPORTANT**: Flex Consumption requires **azurerm provider v4.2 or later**.

## Basic Configuration

```hcl
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.2"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_storage_account" "function_storage" {
  name                     = "${var.resource_prefix}func${var.unique_hash}"
  location                 = var.location
  resource_group_name      = azurerm_resource_group.main.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  
  min_tls_version              = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled    = false  # Enforce managed identity
}

resource "azurerm_storage_container" "deployment_package" {
  name                  = "deploymentpackage"
  storage_account_id    = azurerm_storage_account.function_storage.id
  container_access_type = "private"
}

resource "azurerm_application_insights" "function_insights" {
  name                = "appi-${var.unique_hash}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
}

resource "azurerm_service_plan" "function_plan" {
  name                = "plan-${var.unique_hash}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "FC1"
}

resource "azurerm_linux_function_app" "function_app" {
  name                       = "${var.resource_prefix}-${var.service_name}-${var.unique_hash}"
  location                   = var.location
  resource_group_name        = azurerm_resource_group.main.name
  service_plan_id            = azurerm_service_plan.function_plan.id
  storage_account_name       = azurerm_storage_account.function_storage.name
  storage_uses_managed_identity = true
  https_only                 = true

  identity {
    type = "SystemAssigned"
  }

  function_app_config {
    deployment {
      storage {
        type  = "blob_container"
        value = "${azurerm_storage_account.function_storage.primary_blob_endpoint}${azurerm_storage_container.deployment_package.name}"
        authentication {
          type = "SystemAssignedIdentity"
        }
      }
    }

    scale_and_concurrency {
      maximum_instance_count = 100
      instance_memory_mb     = 2048
    }

    runtime {
      name    = "python"  # or "node", "dotnet-isolated"
      version = "3.11"
    }
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.function_insights.connection_string
    
    application_stack {
      python_version = "3.11"  # Adjust based on runtime
    }
  }

  app_settings = {
    "AzureWebJobsStorage__accountName"  = azurerm_storage_account.function_storage.name
    "FUNCTIONS_EXTENSION_VERSION"       = "~4"
    "FUNCTIONS_WORKER_RUNTIME"          = "python"
  }
}

# Grant Function App access to Storage for runtime
resource "azurerm_role_assignment" "function_storage_access" {
  scope                = azurerm_storage_account.function_storage.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_linux_function_app.function_app.identity[0].principal_id
}
```

> 💡 **Key Points:**
> - Use `AzureWebJobsStorage__accountName` instead of connection string
> - Set `shared_access_key_enabled = false` for enhanced security
> - Use `storage_uses_managed_identity = true` for deployment authentication
> - Grant `Storage Blob Data Owner` role for full access to blobs, queues, and tables
> - Requires azurerm provider **v4.2 or later**

## Using Azure Verified Module

For production deployments, use the official Azure Verified Module:

```hcl
module "function_app" {
  source  = "Azure/avm-res-web-site/azurerm"
  version = "~> 0.0"

  name                = "${var.resource_prefix}-${var.service_name}-${var.unique_hash}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  
  kind    = "functionapp"
  os_type = "Linux"

  sku_name = "FC1"

  function_app_storage_account_name       = azurerm_storage_account.function_storage.name
  function_app_storage_uses_managed_identity = true

  site_config = {
    application_insights_connection_string = azurerm_application_insights.function_insights.connection_string
    
    application_stack = {
      python_version = "3.11"
    }
  }

  app_settings = {
    "AzureWebJobsStorage__accountName" = azurerm_storage_account.function_storage.name
    "FUNCTIONS_EXTENSION_VERSION"      = "~4"
    "FUNCTIONS_WORKER_RUNTIME"         = "python"
  }

  identity = {
    type = "SystemAssigned"
  }
}
```

> 💡 **Example Reference:** [HashiCorp Flex Consumption Example](https://registry.terraform.io/modules/Azure/avm-res-web-site/azurerm/latest/examples/flex_consumption)
