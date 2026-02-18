# Alternative Hosting Plans

## Premium Plan (No Cold Starts)

```hcl
resource "azurerm_service_plan" "function_plan" {
  name                = "${var.resource_prefix}-funcplan-${var.unique_hash}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "EP1"  # EP1, EP2, or EP3
}

resource "azurerm_linux_function_app" "function_app" {
  # ... (rest of configuration similar to Flex Consumption)
  
  site_config {
    # Premium-specific settings
    always_on                      = true
    pre_warmed_instance_count      = 1
    elastic_instance_minimum       = 1
    
    application_stack {
      python_version = "3.11"
    }
  }
}
```

## Consumption Plan (Legacy)

**⚠️ Not recommended for new deployments. Use Flex Consumption instead.**

```hcl
resource "azurerm_storage_account" "function_storage" {
  name                     = "${var.resource_prefix}func${var.unique_hash}"
  location                 = var.location
  resource_group_name      = azurerm_resource_group.main.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_service_plan" "function_plan" {
  name                = "${var.resource_prefix}-funcplan-${var.unique_hash}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "function_app" {
  name                = "${var.resource_prefix}-${var.service_name}-${var.unique_hash}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.function_plan.id
  https_only          = true
  
  storage_account_name       = azurerm_storage_account.function_storage.name
  storage_account_access_key = azurerm_storage_account.function_storage.primary_access_key
  
  site_config {
    application_insights_connection_string = azurerm_application_insights.function_insights.connection_string
    
    application_stack {
      python_version = "3.11"
    }
  }

  app_settings = {
    "FUNCTIONS_EXTENSION_VERSION" = "~4"
    "FUNCTIONS_WORKER_RUNTIME"    = "python"
  }

  identity {
    type = "SystemAssigned"
  }
}
```
