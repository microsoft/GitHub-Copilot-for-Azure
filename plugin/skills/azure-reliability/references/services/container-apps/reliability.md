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

### Environment Zone Redundancy
```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.app/managedenvironments'
| project name, zoneRedundant=properties.zoneRedundant, location,
    hasVnet=isnotempty(properties.vnetConfiguration.infrastructureSubnetId)
" --subscriptions <sub-id>
```

### Container App Replica Count
```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.app/containerapps'
| extend minReplicas = properties.template.scale.minReplicas
| project name, minReplicas, location
" --subscriptions <sub-id>
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

Container Apps support liveness, readiness, and startup probes:

```bash
az containerapp update --name <app> --resource-group <rg> \
  --set-env-vars "HEALTH_CHECK=true" \
  --yaml - <<EOF
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
EOF
```

## Configure: Min Replicas

```bash
az containerapp update --name <app> --resource-group <rg> \
  --min-replicas 2
```

## IaC Patching: Bicep

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
