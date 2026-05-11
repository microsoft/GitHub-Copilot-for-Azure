# IaC Patching — Terraform

## When to Use

Use this reference when the user chooses **"Patch my IaC"** instead of "Fix now" (CLI).
This patches Terraform files in the project's `infra/` folder so reliability settings persist across `terraform apply` / `azd up`.

## Detection

1. Look for `infra/` folder in the project root
2. Check for `*.tf` files (especially `main.tf`, `variables.tf`)
3. Confirm with user: "I found Terraform files in `infra/`. Want me to patch them for reliability?"

## File Discovery

```
# Find all Terraform files
Get-ChildItem -Path infra -Recurse -Filter *.tf

# Common file structure:
# infra/main.tf              — main resources
# infra/variables.tf          — input variables
# infra/terraform.tfvars      — variable values
# infra/modules/              — reusable modules
```

Resource definitions may be in module files. Search all `.tf` files for the resource type.

---

## Patch 1: Zone Redundancy — App Service Plan / Function App Plan

**Find:** `azurerm_service_plan`

**Search pattern:** `resource "azurerm_service_plan"`

**Before:**
```hcl
resource "azurerm_service_plan" "plan" {
  name                = var.plan_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "FC1"
}
```

**After — add `zone_balancing_enabled`:**
```hcl
resource "azurerm_service_plan" "plan" {
  name                   = var.plan_name
  location               = azurerm_resource_group.rg.location
  resource_group_name    = azurerm_resource_group.rg.name
  os_type                = "Linux"
  sku_name               = "FC1"
  zone_balancing_enabled = true
}
```

### Per-SKU Notes

| SKU | Zone Redundancy | Additional Changes |
|-----|-----------------|-------------------|
| FC1 (Flex Consumption) | `zone_balancing_enabled = true` | No other changes |
| EP1/EP2/EP3 (Premium) | `zone_balancing_enabled = true` + `worker_count = 2` | Also set `minimum_elastic_instance_count` on function app |
| P1v2/P1v3+ (App Service) | `zone_balancing_enabled = true` + `worker_count = 2` | Minimum 2 workers required |
| Y1 (Consumption) | ❌ Not supported | Recommend upgrade to Flex Consumption |

**Premium Functions — extra patch on Function App resource:**
```hcl
resource "azurerm_linux_function_app" "func" {
  # ... existing config ...
  site_config {
    minimum_elastic_instance_count = 2  # ← ADD THIS
  }
}
```

---

## Patch 2: Storage Account — LRS to ZRS

**Find:** `azurerm_storage_account`

**Search pattern:** `resource "azurerm_storage_account"`

**Before:**
```hcl
resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}
```

**After — change to ZRS:**
```hcl
resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"
}
```

### Parameterized Replication Type

If parameterized, update the default:

**variables.tf — Before:**
```hcl
variable "storage_replication_type" {
  default = "LRS"
}
```

**After:**
```hcl
variable "storage_replication_type" {
  default = "ZRS"
}
```

Also check `terraform.tfvars` for overrides.

### ⚠️ Existing Deployed Storage

Changing `account_replication_type` in Terraform expresses the **desired end state**, but LRS→ZRS is a **storage redundancy conversion**, not a simple property change. Terraform may attempt an in-place update that fails, or worse, plan a destroy+recreate (data loss risk).

**Always follow this order for existing storage:**
1. Patch Terraform to `account_replication_type = "ZRS"` (desired end state)
2. Run `az storage account migration start` to initiate the live conversion
3. Wait for migration to complete (`az storage account migration show`)
4. Run `terraform plan` — confirm it shows **no changes** (state now matches desired)
5. If plan still shows changes, run `terraform refresh` to sync state, then re-plan

> ⛔ Do NOT run `terraform apply` before the migration completes. It may fail or attempt to recreate the storage account.

---

## Patch 3: Health Check Path — App Service / Function App

**Find:** `azurerm_linux_web_app` or `azurerm_linux_function_app` (or windows variants)

**Search patterns:**
- `resource "azurerm_linux_web_app"`
- `resource "azurerm_linux_function_app"`
- `resource "azurerm_windows_web_app"`
- `resource "azurerm_windows_function_app"`

**Before:**
```hcl
resource "azurerm_linux_web_app" "app" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  site_config {}
}
```

**After — add `health_check_path`:**
```hcl
resource "azurerm_linux_web_app" "app" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  site_config {
    health_check_path = "/api/health"
  }
}
```

### ⚠️ Plan Type Gating

Same as Bicep — do NOT add `health_check_path` for Flex Consumption or Consumption plans. Add a comment instead:

```hcl
# Health check: Add /api/health HTTP endpoint in your function app code.
# Platform health check is not supported on Flex Consumption.
```

---

## Patch 4: Container Apps Environment — Zone Redundancy

**Find:** `azurerm_container_app_environment`

**Search pattern:** `resource "azurerm_container_app_environment"`

**Before:**
```hcl
resource "azurerm_container_app_environment" "env" {
  name                       = var.env_name
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
}
```

**After — add `zone_redundancy_enabled`:**

> ⚠️ **Prerequisite:** Zone redundancy for Container Apps environments requires a **VNet with infrastructure subnet**. If `infrastructure_subnet_id` is not set, you must add VNet resources before enabling zone redundancy.

```hcl
resource "azurerm_container_app_environment" "env" {
  name                       = var.env_name
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
  zone_redundancy_enabled    = true
  infrastructure_subnet_id   = azurerm_subnet.infrastructure.id  # ← REQUIRED for zone redundancy
}
```

If VNet resources do not exist in the project, add:
```hcl
resource "azurerm_virtual_network" "vnet" {
  name                = "${var.env_name}-vnet"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_subnet" "infrastructure" {
  name                 = "infrastructure"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.0.0/23"]  # /23 minimum for Container Apps

  delegation {
    name = "container-apps"
    service_delegation {
      name = "Microsoft.App/environments"
    }
  }
}
```

### ⚠️ Critical: Existing Environments

Zone redundancy is **immutable after creation**. If environment exists without it:
- Terraform will try to update in-place → **will fail**
- Must force recreation by changing the name or using `terraform taint`

```hcl
resource "azurerm_container_app_environment" "env" {
  name                       = "${var.env_name}-zr"  # ← new name forces recreation
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
  zone_redundancy_enabled    = true
}
```

⚠️ This will destroy the old environment and all apps in it. Recommend blue/green migration:
1. Create new environment with ZR (new name)
2. Update container app resources to reference new environment
3. Apply — apps recreated in new environment
4. Verify — then remove old environment reference

**Blue/green migration checklist:**
- [ ] All `azurerm_container_app` resources — update `container_app_environment_id`
- [ ] Environment certificates and custom domains — recreate on new environment
- [ ] Environment storage mounts — recreate on new environment
- [ ] Dapr components — recreate on new environment
- [ ] Any other environment-scoped resources

> Note: Terraform's `container_app_environment_id` is marked **ForceNew**, so apps referencing the new env will be automatically recreated.

---

## Patch 5: Container Apps — Liveness & Readiness Probes

**Find:** `azurerm_container_app`

**Search pattern:** `resource "azurerm_container_app"`

**Add probes inside the template container block:**

```hcl
resource "azurerm_container_app" "app" {
  name                         = var.app_name
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name

  template {
    min_replicas = 2  # ← ensure ≥2 for zone redundancy

    container {
      name   = "main"
      image  = var.image_name
      cpu    = 0.5
      memory = "1Gi"

      # ← ADD liveness probe
      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8080
        interval_seconds    = 10
        failure_count_threshold = 3
      }

      # ← ADD readiness probe
      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8080
        interval_seconds    = 5
        failure_count_threshold = 3
      }
    }
  }
}
```

---

## Patch Summary Checklist

| # | Resource | Property | Value |
|---|----------|----------|-------|
| 1 | `azurerm_service_plan` | `zone_balancing_enabled` | `true` |
| 2 | `azurerm_service_plan` (Premium) | `worker_count` | `≥ 2` |
| 3 | `azurerm_linux_function_app` (Premium) | `site_config.minimum_elastic_instance_count` | `≥ 2` |
| 4 | `azurerm_storage_account` | `account_replication_type` | `"ZRS"` |
| 5 | `azurerm_linux_web_app` (Premium/Dedicated) | `site_config.health_check_path` | `"/api/health"` |
| 6 | `azurerm_container_app_environment` | `zone_redundancy_enabled` | `true` |
| 7 | `azurerm_container_app` | `liveness_probe` + `readiness_probe` | HTTP /health |
| 8 | `azurerm_container_app` | `template.min_replicas` | `≥ 2` |

After patching, tell the user:
```
✅ Terraform files patched for reliability. Run `terraform plan` to review changes,
   then `terraform apply` (or `azd up`) to deploy.

⚠️ Note: If you have an existing Container Apps environment without zone redundancy,
   the environment name was changed to force recreation. Review the plan carefully
   before applying — apps will be recreated in the new environment.
```
