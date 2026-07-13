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

# Image variable defaults to placeholder so provisioning succeeds before first azd deploy
variable "web_image" {
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
  description = "Container image for the web service (replaced by azd on deploy)"
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

resource "azurerm_container_registry" "acr" {
  name                = "cr${random_string.resource_token.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = { "azd-env-name" = var.environment_name }
}

resource "azurerm_container_app_environment" "cae" {
  name                = "cae-${random_string.resource_token.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  tags                = { "azd-env-name" = var.environment_name }
}

resource "azurerm_container_app" "web" {
  name                         = "ca-${random_string.resource_token.result}"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  identity {
    type = "SystemAssigned"
  }

  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = "System"
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    container {
      name   = "web"
      image  = var.web_image
      cpu    = 0.5
      memory = "1Gi"
    }
  }

  tags = {
    "azd-env-name"     = var.environment_name
    "azd-service-name" = "web"
  }

  lifecycle {
    ignore_changes = [
      template[0].container[0].image
    ]
  }
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_container_app.web.identity[0].principal_id
}

output "AZURE_LOCATION" {
  value = var.location
}

output "AZURE_CONTAINER_REGISTRY_ENDPOINT" {
  value = azurerm_container_registry.acr.login_server
}

output "WEB_URL" {
  value = "https://${azurerm_container_app.web.ingress[0].fqdn}"
}
