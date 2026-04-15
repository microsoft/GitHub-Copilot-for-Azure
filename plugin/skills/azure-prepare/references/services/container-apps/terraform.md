# Container Apps Terraform Patterns

> **⚠️ Container Registry Naming:** ACR names must be alphanumeric only (5-50 characters). Use `replace()` in azurecaf or strip hyphens manually.

> **⚠️ Two-Phase Deployment (Mandatory):** To avoid the chicken-and-egg problem where Terraform tries to create a Container App referencing an ACR image that doesn't exist yet:
> - **Phase 1 (`terraform apply`):** Deploy ACR and Container App with a **public placeholder image** and **no `registry` block**.
> - **Phase 2 (post-apply CLI):** Build/push the app image to ACR, configure the registry/identity link, then update the Container App image.
>
> This mirrors the [Bicep two-phase pattern](bicep.md). Without it, `terraform apply` fails with `ContainerAppOperationError` because the image doesn't exist in ACR yet.

## Phase 1: Container App Resource (No Registry Block)

```hcl
# Placeholder image allows provisioning before the app image exists in ACR.
# No registry block in Terraform during Phase 1 — the registry/identity link is
# configured via CLI after provisioning (see Phase 2 below).
resource "azurerm_container_app" "api" {
  name                         = azurecaf_name.container_app.result
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  identity {
    type = "SystemAssigned"
  }

  tags = merge(var.tags, {
    "azd-service-name" = "api"
  })

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "api"
      image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8080

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  # Phase 2 updates the image and adds a registry block via CLI.
  # Prevent Terraform from reverting those changes on subsequent applies.
  lifecycle {
    ignore_changes = [
      template[0].container[0].image,
      registry,
    ]
  }
}
```

## AcrPull Role Assignment

Deploy the `AcrPull` role assignment as a **separate resource** that depends on the Container App (to read its system-assigned identity principal ID). Neither the ACR nor the Container App depends on this resource, so there is no circular dependency.

```hcl
resource "azurerm_role_assignment" "api_acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_container_app.api.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}
```

> 💡 **Tip:** Always set `principal_type = "ServicePrincipal"` for managed identities. This skips the Graph API lookup and speeds up role assignment propagation.

## Phase 2: Post-Apply Deployment (CLI)

After `terraform apply` succeeds, run these commands to build the real image and switch the Container App to it:

```bash
ACR_NAME=$(terraform output -raw acr_name)
ACR_SERVER=$(terraform output -raw acr_login_server)
APP_NAME=$(terraform output -raw container_app_name)
RG_NAME=$(terraform output -raw resource_group_name)

# 1. Build and push the application image to ACR
az acr build --registry $ACR_NAME --image myapp:latest ./src/api

# 2. Configure the registry/identity link (managed identity, no passwords)
az containerapp registry set \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --server $ACR_SERVER \
  --identity system

# 3. Update the Container App to use the real image
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --image $ACR_SERVER/myapp:latest
```

**PowerShell:**
```powershell
$AcrName = terraform output -raw acr_name
$AcrServer = terraform output -raw acr_login_server
$AppName = terraform output -raw container_app_name
$RgName = terraform output -raw resource_group_name

# 1. Build and push the application image to ACR
az acr build --registry $AcrName --image myapp:latest ./src/api

# 2. Configure the registry/identity link (managed identity, no passwords)
az containerapp registry set `
  --name $AppName `
  --resource-group $RgName `
  --server $AcrServer `
  --identity system

# 3. Update the Container App to use the real image
az containerapp update `
  --name $AppName `
  --resource-group $RgName `
  --image "$AcrServer/myapp:latest"
```

> ⚠️ **Warning:** Step 2 requires the `AcrPull` role assignment to have propagated (1–5 minutes after `terraform apply`). If the image pull fails, wait and retry. See the [RBAC propagation wait](../../../azure-deploy/references/pre-deploy-checklist.md#container-apps--acr--pre-deploy-rbac-health-check) in the pre-deploy checklist.

## Terraform Outputs

Export the values needed by Phase 2:

```hcl
output "acr_name" {
  value = azurerm_container_registry.acr.name
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "container_app_name" {
  value = azurerm_container_app.api.name
}

output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "api_url" {
  value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}
```

## Container Apps Environment

```hcl
resource "azurerm_container_app_environment" "env" {
  name                       = azurecaf_name.container_app_env.result
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}
```
