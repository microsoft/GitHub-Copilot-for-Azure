# recipes/cosmosdb/terraform/cosmos.tf
# Cosmos DB recipe module for Terraform — adds Cosmos DB account, database,
# containers, RBAC, and networking to an Azure Functions base template.
#
# USAGE: Copy this file into infra/ alongside the base template's main.tf.
# Reference the function app identity from the base template.

# ============================================================================
# Variables (add to variables.tf if not already present)
# ============================================================================
variable "cosmos_database_name" {
  type        = string
  default     = "documents-db"
  description = "Cosmos DB database name"
}

variable "cosmos_container_name" {
  type        = string
  default     = "documents"
  description = "Cosmos DB container name"
}

# ============================================================================
# Naming
# ============================================================================
resource "azurecaf_name" "cosmos_account" {
  name          = var.environment_name
  resource_type = "azurerm_cosmosdb_account"
  random_length = 5
}

# ============================================================================
# Cosmos DB Account (Serverless)
# ============================================================================
resource "azurerm_cosmosdb_account" "main" {
  name                = azurecaf_name.cosmos_account.result
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  tags = merge(local.tags, {})

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }

  capabilities {
    name = "EnableServerless"
  }
}

# ============================================================================
# Database
# ============================================================================
resource "azurerm_cosmosdb_sql_database" "main" {
  name                = var.cosmos_database_name
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

# ============================================================================
# Containers
# ============================================================================
resource "azurerm_cosmosdb_sql_container" "data" {
  name                = var.cosmos_container_name
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/id"]

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/*"
    }
  }
}

resource "azurerm_cosmosdb_sql_container" "leases" {
  name                = "leases"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/id"]
}

# ============================================================================
# RBAC: Azure Control Plane — Cosmos DB Account Reader
# ============================================================================
resource "azurerm_role_assignment" "cosmos_account_reader" {
  scope                = azurerm_cosmosdb_account.main.id
  role_definition_name = "Cosmos DB Account Reader Role"
  principal_id         = azurerm_user_assigned_identity.func_identity.principal_id
  principal_type       = "ServicePrincipal"
}

# ============================================================================
# RBAC: Cosmos SQL Data Plane — Built-in Data Contributor
# ============================================================================
resource "azurerm_cosmosdb_sql_role_assignment" "data_contributor" {
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  # Built-in Cosmos DB Data Contributor role
  role_definition_id = "${azurerm_cosmosdb_account.main.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id       = azurerm_user_assigned_identity.func_identity.principal_id
  scope              = azurerm_cosmosdb_account.main.id
}

# ============================================================================
# Networking: Private Endpoint (conditional on vnet_enabled)
# ============================================================================
resource "azurerm_private_dns_zone" "cosmos" {
  count               = var.vnet_enabled ? 1 : 0
  name                = "privatelink.documents.azure.com"
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "cosmos" {
  count                 = var.vnet_enabled ? 1 : 0
  name                  = "cosmos-dns-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.cosmos[0].name
  virtual_network_id    = azurerm_virtual_network.main[0].id
}

resource "azurerm_private_endpoint" "cosmos" {
  count               = var.vnet_enabled ? 1 : 0
  name                = "pe-${azurerm_cosmosdb_account.main.name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.private_endpoints[0].id
  tags                = local.tags

  private_service_connection {
    name                           = "cosmos-connection"
    private_connection_resource_id = azurerm_cosmosdb_account.main.id
    subresource_names              = ["Sql"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "cosmos-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.cosmos[0].id]
  }
}

# ============================================================================
# Function App Settings Additions
# (merge these into the function app's app_settings block in main.tf)
# ============================================================================
locals {
  cosmos_app_settings = {
    "COSMOS_CONNECTION__accountEndpoint" = azurerm_cosmosdb_account.main.endpoint
    "COSMOS_DATABASE_NAME"               = var.cosmos_database_name
    "COSMOS_CONTAINER_NAME"              = var.cosmos_container_name
  }
}

# ============================================================================
# Outputs
# ============================================================================
output "COSMOS_ACCOUNT_ENDPOINT" {
  value = azurerm_cosmosdb_account.main.endpoint
}

output "COSMOS_DATABASE_NAME" {
  value = var.cosmos_database_name
}

output "COSMOS_CONTAINER_NAME" {
  value = var.cosmos_container_name
}
