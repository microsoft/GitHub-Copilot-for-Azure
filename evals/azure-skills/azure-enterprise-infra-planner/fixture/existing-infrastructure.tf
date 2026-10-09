# fixture-id: enterprise-planner-referenced-tf-v1
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "shared" {
  name     = "corp-shared-rg-tf"
  location = "eastus2"
}

resource "azurerm_virtual_network" "hub" {
  name                = "corp-hub-vnet-tf"
  location            = azurerm_resource_group.shared.location
  resource_group_name = azurerm_resource_group.shared.name
  address_space       = ["10.30.0.0/16"]
}

resource "azurerm_subnet" "private_endpoints" {
  name                 = "private-endpoints"
  resource_group_name  = azurerm_resource_group.shared.name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = ["10.30.2.0/24"]
}

resource "azurerm_log_analytics_workspace" "operations" {
  name                = "corp-ops-law-tf"
  location            = azurerm_resource_group.shared.location
  resource_group_name = azurerm_resource_group.shared.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_key_vault" "shared" {
  name                          = "corp-shared-kv-tf"
  location                      = azurerm_resource_group.shared.location
  resource_group_name           = azurerm_resource_group.shared.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  enable_rbac_authorization     = true
  purge_protection_enabled      = true
  public_network_access_enabled = false
}