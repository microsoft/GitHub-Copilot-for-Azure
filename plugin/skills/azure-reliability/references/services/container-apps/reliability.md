# Azure Container Apps — Reliability Reference

## Zone Redundancy

| Requirement | Details |
|-------------|---------|
| Set at | **Environment creation time** (immutable after) |
| Requires | VNet with infrastructure subnet (/23 minimum) |
| SKU | Consumption or Dedicated (both support ZR) |
| Min replicas | ≥ 2 for zone distribution |

⚠️ **Critical:** Zone redundancy cannot be enabled on an existing environment. Must create a new environment with ZR and migrate apps (blue/green).

## Assessment Queries

> **⚠️ Output format:** Use `--query "data[]" -o json` for `az graph query`. `-o table` only shows summary columns (`Count`, `Total_records`) and hides projected fields.

### Environment Zone Redundancy
```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.app/managedenvironments'
| project name, zoneRedundant=properties.zoneRedundant, location,
    hasVnet=isnotempty(properties.vnetConfiguration.infrastructureSubnetId)
" --subscriptions <sub-id> --query "data[]" -o json
```

### Container App Replica Count
```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.app/containerapps'
| extend minReplicas = properties.template.scale.minReplicas
| project name, minReplicas, location
" --subscriptions <sub-id> --query "data[]" -o json
```

### Health Probes Check
```bash
az containerapp show --name <app> --resource-group <rg> \
  --query "properties.template.containers[0].probes" -o json
```

## Configure: Zone Redundancy (New Environment)

```bash
# Requires VNet first
az network vnet create \
  --name <vnet-name> \
  --resource-group <rg> \
  --location <location> \
  --address-prefix 10.0.0.0/16

az network vnet subnet create \
  --name infrastructure \
  --vnet-name <vnet-name> \
  --resource-group <rg> \
  --address-prefix 10.0.0.0/23 \
  --delegations Microsoft.App/environments

# Create zone-redundant environment
az containerapp env create \
  --name <env-name> \
  --resource-group <rg> \
  --location <location> \
  --infrastructure-subnet-resource-id <subnet-id> \
  --zone-redundant
```

## Configure: Blue/Green Migration (Existing Environment)

If the environment already exists without ZR:

1. **Create new ZR environment** (new name)
2. **Migrate each app:**
```bash
# Export app config
az containerapp show --name <app> -g <rg> -o json > app-config.json

# Create in new environment (modify environmentId)
az containerapp create \
  --name <app> \
  --resource-group <rg> \
  --environment <new-env-name> \
  --yaml app-config.yaml
```
3. **Switch traffic** (update DNS/Front Door origins)
4. **Delete old environment** after verification

**Migration checklist:**
- [ ] All container apps
- [ ] Environment certificates & custom domains
- [ ] Environment storage mounts
- [ ] Dapr components
- [ ] Managed identities & RBAC

## Configure: Health Probes

Container Apps support liveness, readiness, and startup probes. Author them in a YAML file and apply with `az containerapp update --yaml`:

**probes.yaml:**
```yaml
properties:
  template:
    containers:
      - name: main
        probes:
          - type: liveness
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 10
            failureThreshold: 3
          - type: readiness
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 5
            failureThreshold: 3
          - type: startup
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 5
            failureThreshold: 30
```

```bash
az containerapp update --name <app> --resource-group <rg> --yaml probes.yaml
```

### ⛔ STOP — If the container has no `/health` endpoint, ask before adding code

Adding `probes` against a path that doesn't exist will mark every replica unhealthy. If the container image doesn't already serve a `/health` route, **ask the user before modifying their source code**:

```
⚠️ This container app has no health probes configured, and I don't see a `/health`
   route in the container image. To enable readiness + liveness probes I would need to:
     • Add a GET /health handler to your app code (returns 200 OK)
     • Rebuild and push the container image
     • Then update the Container App with the probes

   Do you want me to add the /health endpoint to your code? (yes / no)
```

Proceed only on explicit yes. If no, leave both the code and the IaC unchanged and report the row as `🔴 OFF (code-only fix — declined)` in the assessment table.

## Configure: Min Replicas

```bash
az containerapp update --name <app> --resource-group <rg> \
  --min-replicas 2
```

## IaC Patching: Bicep

> **AVM modules:** If the project uses `br/public:avm/res/app/managed-environment` or `br/public:avm/res/app/container-app`, the parameter names differ from raw ARM (e.g. `zoneRedundant` becomes a top-level param). Always grep the actual module call (`Select-String -Path infra -Recurse -Pattern "avm/res/app/" -Context 0,15`) and patch the params already in use. The raw-Bicep examples below show the property paths to translate.

### Environment (new — with VNet)
```bicep
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    zoneRedundant: true                              // ← ADD
    vnetConfiguration: {
      infrastructureSubnetId: subnet.id              // ← REQUIRED for ZR
    }
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}
```

### Container App — probes + minReplicas
```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  properties: {
    template: {
      containers: [
        {
          name: 'main'
          image: imageName
          probes: [                                   // ← ADD
            {
              type: 'liveness'
              httpGet: { path: '/health', port: 8080 }
              periodSeconds: 10
              failureThreshold: 3
            }
            {
              type: 'readiness'
              httpGet: { path: '/health', port: 8080 }
              periodSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 2                               // ← ADD (for ZR distribution)
      }
    }
  }
}
```

## IaC Patching: Terraform

### Environment
```hcl
resource "azurerm_container_app_environment" "env" {
  name                       = var.env_name
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
  zone_redundancy_enabled    = true                          # ← ADD
  infrastructure_subnet_id   = azurerm_subnet.infra.id       # ← REQUIRED for ZR
}
```

### Container App — probes + minReplicas
```hcl
resource "azurerm_container_app" "app" {
  template {
    min_replicas = 2   # ← ADD

    container {
      name   = "main"
      image  = var.image

      liveness_probe {                       # ← ADD
        transport               = "HTTP"
        path                    = "/health"
        port                    = 8080
        interval_seconds        = 10
        failure_count_threshold = 3
      }

      readiness_probe {                      # ← ADD
        transport               = "HTTP"
        path                    = "/health"
        port                    = 8080
        interval_seconds        = 5
        failure_count_threshold = 3
      }
    }
  }
}
```

## Multi-Region Notes

- Container Apps environments are regional — deploy a separate environment per region
- Both environments need VNet + ZR
- Use Front Door to route between regions
- Dapr service-to-service calls don't cross regions automatically — plan for cross-region communication
- Consider Consumption plan in secondary to reduce standby costs

## Reporting (for the assessment table)

When the parent skill builds the feature-pivoted assessment table, report each Container Apps resource on the relevant rows:

| Feature row | What to report |
|---|---|
| Zone redundancy — compute | `🟢 ON` if the **environment** has `zoneRedundant: true` and a VNet infrastructure subnet, else `🔴 OFF`. Container apps inherit this from the environment. |
| Health probes | `🟢 ON` if the container has both liveness AND readiness probes; `🟡 PARTIAL` if only one is set; `🔴 OFF` if none. Annotate `(code-only fix)` if the image doesn't expose a `/health` route. |
| Multi-region failover | `🟢 ON` if the same app is deployed in ≥2 regions behind Front Door; otherwise `🔴 OFF`. |

