# Terraform Validation Errors

| Error | Fix |
|-------|-----|
| `Backend init failed` | Check storage account access |
| `Provider version conflict` | Update required_providers |
| `State lock failed` | Wait or force unlock |
| `Validation failed` | Check terraform validate output |
| `Error: Cycle` | See [Cycle Errors](#cycle-errors) below |

## Cycle Errors

`terraform validate` reports a cycle when two or more resources reference each other's attributes, creating a circular dependency.

### Common Pattern: CORS Cross-Reference

Multi-service App Service deployments often introduce a cycle when the API's CORS configuration references the frontend hostname and the frontend's app settings reference the API hostname:

```
Error: Cycle: azurerm_linux_web_app.frontend, azurerm_linux_web_app.api
```

**Cause — circular attribute references:**

```hcl
# API references frontend.default_hostname in CORS
resource "azurerm_linux_web_app" "api" {
  site_config {
    cors {
      allowed_origins = ["https://${azurerm_linux_web_app.frontend.default_hostname}"]
    }
  }
}

# Frontend references api.default_hostname in app_settings
resource "azurerm_linux_web_app" "frontend" {
  app_settings = {
    API_URL = "https://${azurerm_linux_web_app.api.default_hostname}"
  }
}
```

### Fix Strategies

**Option A (recommended):** Break the cycle by using a wildcard or removing one side of the cross-reference. Set CORS to allow all origins and configure the specific origin post-deployment:

```hcl
resource "azurerm_linux_web_app" "api" {
  site_config {
    cors {
      allowed_origins     = ["*"]
      support_credentials = false
    }
  }
}
```

**Option B:** Use `azurerm_app_service_custom_hostname_binding` or a `null_resource` with a `local-exec` provisioner to configure CORS after both resources are created, breaking the dependency chain.

**Option C:** Use `lifecycle { ignore_changes = [site_config[0].cors] }` on the API resource and configure CORS via a separate `azurerm_web_app_active_slot` or post-deployment script.

### After Fixing

1. Run `terraform fmt -recursive` to fix formatting
2. Re-run `terraform validate` to confirm the cycle is resolved
3. Run `terraform plan` to verify the configuration is correct

## Debug

```bash
TF_LOG=DEBUG terraform plan
```
