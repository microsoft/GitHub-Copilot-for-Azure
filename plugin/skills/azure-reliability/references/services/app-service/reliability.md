# Azure App Service — Reliability Reference

## Supported Plans & Zone Redundancy

| Plan | Zone Redundancy | Min Instances | Health Check |
|------|----------------|---------------|--------------|
| Free/Shared (F1/D1) | ❌ Not supported | N/A | ❌ |
| Basic (B1/B2/B3) | ❌ Not supported | N/A | ❌ |
| Standard (S1/S2/S3) | ❌ Not supported | N/A | ✅ |
| Premium v2 (P1v2+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 | ✅ |
| Premium v3 (P1v3+) | ✅ `zoneRedundant: true` + `capacity: 3` | 3 (recommended) | ✅ |
| Isolated v2 (I1v2+) | ✅ (ASE is ZR by default) | Per ASE | ✅ |

## Assessment Queries

### Plan Zone Redundancy
```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.web/serverfarms'
| where kind !contains 'functionapp'
| project name, sku=sku.name, capacity=sku.capacity, zoneRedundant=properties.zoneRedundant, location
" --subscriptions <sub-id>
```

### Health Check Configuration
```bash
az webapp config show --name <app> --resource-group <rg> \
  --query "{healthCheckPath:healthCheckPath, alwaysOn:alwaysOn}" -o table
```

### Deployment Slots (for zero-downtime deploys)
```bash
az webapp deployment slot list --name <app> --resource-group <rg> \
  --query "[].{name:name, state:state}" -o table
```

## Configure: Zone Redundancy

### Upgrade Plan (if needed)
```bash
# Check current SKU
az appservice plan show --name <plan> --resource-group <rg> --query "sku"

# Upgrade to Premium v3 (if currently on lower tier)
az appservice plan update \
  --name <plan> \
  --resource-group <rg> \
  --sku P1v3
```

### Enable Zone Redundancy
```bash
# Set min instances (required for ZR)
az appservice plan update \
  --name <plan> \
  --resource-group <rg> \
  --number-of-workers 3

# Enable ZR
az resource update \
  --resource-group <rg> \
  --name <plan> \
  --resource-type "Microsoft.Web/serverfarms" \
  --set properties.zoneRedundant=true
```

⚠️ Enabling zone redundancy may require scaling up first — there must be at least as many instances as availability zones (typically 3).

## Configure: Health Check

```bash
# Enable health check
az webapp config set \
  --name <app> \
  --resource-group <rg> \
  --generic-configurations '{"healthCheckPath": "/api/health"}'
```

⚠️ **Warning:** Enabling health check causes an app restart. Configure during maintenance window.

### Health Check Behavior
- Ping interval: **1 minute**
- Failure threshold: **10 consecutive failures** (configurable via `WEBSITE_HEALTHCHECK_MAXPINGFAILURES`)
- After threshold: instance marked unhealthy, replaced within **1 hour**
- Healthy threshold: **1 successful response** restores instance

### Recommended: Always On
```bash
az webapp config set \
  --name <app> \
  --resource-group <rg> \
  --always-on true
```

## Configure: Deployment Slots (Zero-Downtime)

Deployment slots complement reliability by enabling safe deployments:

```bash
# Create staging slot
az webapp deployment slot create \
  --name <app> \
  --resource-group <rg> \
  --slot staging

# Deploy to staging first, then swap
az webapp deployment slot swap \
  --name <app> \
  --resource-group <rg> \
  --slot staging \
  --target-slot production
```

## IaC Patching: Bicep

### App Service Plan
```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: 'P1v3'
    capacity: 3              // ← ADD (min 3 for ZR on P1v3)
  }
  properties: {
    reserved: true           // Linux
    zoneRedundant: true      // ← ADD
  }
}
```

### Web App — Health Check
```bicep
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      healthCheckPath: '/api/health'  // ← ADD
      alwaysOn: true                  // ← ADD (recommended)
    }
  }
}
```

## IaC Patching: Terraform

### App Service Plan
```hcl
resource "azurerm_service_plan" "plan" {
  name                   = var.plan_name
  location               = azurerm_resource_group.rg.location
  resource_group_name    = azurerm_resource_group.rg.name
  os_type                = "Linux"
  sku_name               = "P1v3"
  worker_count           = 3                   # ← ADD (min 3 for ZR)
  zone_balancing_enabled = true                # ← ADD
}
```

### Web App — Health Check
```hcl
resource "azurerm_linux_web_app" "app" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  site_config {
    health_check_path = "/api/health"    # ← ADD
    always_on         = true             # ← ADD
  }
}
```

## Multi-Region Notes

- App Service supports deployment slots — use slot swap for safe regional deployments
- Consider auto-scale rules to handle failover traffic surge
- App Service Managed Certificates don't support custom domains on Front Door — use App Service Certificate or Key Vault
- ARR affinity should be disabled for multi-region (stateless design)
```bash
az webapp update --name <app> --resource-group <rg> \
  --client-affinity-enabled false
```
