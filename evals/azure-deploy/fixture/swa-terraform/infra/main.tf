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

resource "azurerm_static_web_app" "swa" {
  name                = "swa-${random_string.resource_token.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = {
    "azd-env-name"     = var.environment_name
    "azd-service-name" = "web"
  }
}

output "AZURE_LOCATION" {
  value = var.location
}

output "STATIC_WEB_APP_URL" {
  value = azurerm_static_web_app.swa.default_host_name
}
