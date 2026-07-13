terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
}

variable "environment_name" {
  type        = string
  description = "Name of the azd environment"
}

variable "location" {
  type        = string
  description = "Azure region for all resources"
}

resource "random_string" "resource_token" {
  length  = 13
  upper   = false
  special = false
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${var.environment_name}"
  location = var.location
  tags     = { "azd-env-name" = var.environment_name }
}

resource "azurerm_service_plan" "plan" {
  name                = "plan-${random_string.resource_token.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1"
}

resource "azurerm_linux_web_app" "app" {
  name                = "app-${random_string.resource_token.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id
  https_only          = true

  site_config {
    application_stack {
      node_version = "20-lts"
    }
  }

  tags = {
    "azd-env-name"     = var.environment_name
    "azd-service-name" = "web"
  }
}

output "AZURE_LOCATION" {
  value = var.location
}

output "WEB_URL" {
  value = "https://${azurerm_linux_web_app.app.default_hostname}"
}
