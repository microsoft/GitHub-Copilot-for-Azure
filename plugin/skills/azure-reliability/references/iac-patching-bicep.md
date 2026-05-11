# IaC Patching — Bicep

## When to Use

Use this reference when the user chooses **"Patch my IaC"** instead of "Fix now" (CLI).
This patches Bicep files in the project's `infra/` folder so reliability settings persist across `azd up`.

## Detection

1. Look for `infra/` folder in the project root
2. Check for `*.bicep` files (especially `main.bicep`, `main.parameters.json`)
3. Confirm with user: "I found Bicep files in `infra/`. Want me to patch them for reliability?"

## File Discovery

Search for resources to patch using these patterns:

```
# Find all Bicep files
Get-ChildItem -Path infra -Recurse -Filter *.bicep

# Common file structure:
# infra/main.bicep          — orchestrator, references modules
# infra/main.parameters.json — parameters
# infra/app/                 — app-specific modules
# infra/core/               — shared modules (host, storage, monitoring)
```

The resource definitions may be in module files, not `main.bicep`. Search all `.bicep` files for the resource type.

---

## Patch 1: Zone Redundancy — App Service Plan / Function App Plan

**Find:** `Microsoft.Web/serverfarms`

**Search pattern:** `resource .* 'Microsoft.Web/serverfarms@`

**Before:**
```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  kind: 'functionapp'
  properties: {
    reserved: true
  }
}
```

**After — add `zoneRedundant: true`:**
```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  kind: 'functionapp'
  properties: {
    reserved: true
    zoneRedundant: true
  }
}
```

### Per-SKU Notes

| SKU | Zone Redundancy | Additional Changes |
|-----|-----------------|-------------------|
| FC1 (Flex Consumption) | `zoneRedundant: true` | No other changes needed |
| EP1/EP2/EP3 (Premium) | `zoneRedundant: true` + `sku.capacity: 2` | Also set `minimumElasticInstanceCount: 2` on each Function App |
| P1v2/P1v3+ (App Service) | `zoneRedundant: true` + `sku.capacity: 2` | Minimum 2 instances required |
| Consumption (Y1) | ❌ Not supported | Recommend upgrade to Flex Consumption |

**Premium Functions — extra patch on Function App resource:**
```bicep
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  // ... existing config ...
  properties: {
    siteConfig: {
      minimumElasticInstanceCount: 2  // ← ADD THIS
    }
  }
}
```

---

## Patch 2: Storage Account — LRS to ZRS

**Find:** `Microsoft.Storage/storageAccounts`

**Search pattern:** `resource .* 'Microsoft.Storage/storageAccounts@`

**Before:**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
```

**After — change to ZRS:**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_ZRS'
  }
  kind: 'StorageV2'
}
```

### Parameterized SKU (common pattern)

If the SKU is parameterized, update the default value:

**Before:**
```bicep
param storageSku string = 'Standard_LRS'
```

**After:**
```bicep
param storageSku string = 'Standard_ZRS'
```

Also check `main.parameters.json` for overrides:
```json
{
  "storageSku": {
    "value": "Standard_ZRS"
  }
}
```

### ⚠️ Important: Existing Deployed Storage

Changing SKU in Bicep expresses the **desired end state**, but does NOT automatically migrate existing storage.

- **New storage account** → deploys as ZRS directly ✅
- **Existing storage account** → ARM may attempt an in-place SKU update, but LRS→ZRS is a **storage redundancy conversion**, not a simple property change. For supported StorageV2/GPv2 accounts in supported regions, Azure can perform live conversion, but this is not guaranteed and the deployment may fail for unsupported account kinds.

**Always follow this order for existing storage:**
1. Patch the Bicep to `Standard_ZRS` (desired end state)
2. Run `az storage account migration start` to initiate the live conversion
3. Wait for migration to complete (`az storage account migration show`)
4. Then run `azd up` / deploy — the Bicep now matches the actual state

> ⛔ Do NOT run `azd up` before the migration completes. The deployment may fail or conflict with the in-progress migration.

---

## Patch 3: Health Check Path — App Service / Function App

**Find:** `Microsoft.Web/sites`

**Search pattern:** `resource .* 'Microsoft.Web/sites@`

**Before:**
```bicep
resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      appSettings: [...]
    }
  }
}
```

**After — add `healthCheckPath`:**
```bicep
resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      healthCheckPath: '/api/health'
      appSettings: [...]
    }
  }
}
```

### ⚠️ Plan Type Gating

| Plan | Health Check Support |
|------|---------------------|
| Flex Consumption (FC1) | ❌ Platform health check not supported. Recommend adding `/api/health` endpoint in code only. |
| Premium (EP1+) | ✅ Set `healthCheckPath` |
| App Service (P1v2+) | ✅ Set `healthCheckPath` |
| Consumption (Y1) | ❌ Not supported |

**Do NOT add `healthCheckPath` to Flex Consumption or Consumption plans.** It will be ignored or cause errors. Instead, add a comment:

```bicep
// Health check: Add /api/health HTTP endpoint in your function app code.
// Platform health check is not supported on Flex Consumption.
```

---

## Patch 4: Container Apps Environment — Zone Redundancy

**Find:** `Microsoft.App/managedEnvironments`

**Search pattern:** `resource .* 'Microsoft.App/managedEnvironments@`

**Before:**
```bicep
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}
```

**After — add `zoneRedundant: true`:**

> ⚠️ **Prerequisite:** Zone redundancy for Container Apps environments requires a **VNet with infrastructure subnet**. If `vnetConfiguration.infrastructureSubnetId` is not set, you must add VNet IaC before enabling zone redundancy.

```bicep
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    zoneRedundant: true
    vnetConfiguration: {
      infrastructureSubnetId: subnet.id  // ← REQUIRED for zone redundancy
    }
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}
```

If VNet IaC does not exist in the project, add:
```bicep
resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: '${envName}-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'infrastructure'
        properties: {
          addressPrefix: '10.0.0.0/23'  // /23 minimum for Container Apps
          delegations: [
            {
              name: 'Microsoft.App.environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
    ]
  }
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  parent: vnet
  name: 'infrastructure'
}
```

### ⚠️ Critical: Existing Environments

Zone redundancy on Container Apps environments is **immutable after creation**. If the environment already exists without zone redundancy:

1. **IaC patch alone won't fix it** — `azd up` will NOT enable zone redundancy on an existing environment
2. Must do a **blue/green migration**: create new environment with ZR → migrate apps → delete old environment
3. In the Bicep, change the environment name to force a new resource:

```bicep
// Force new zone-redundant environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${envName}-zr'  // ← new name forces new resource
  location: location
  properties: {
    zoneRedundant: true
    vnetConfiguration: {
      infrastructureSubnetId: subnet.id
    }
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}
```

Then explicitly update all resources that reference the old environment:

**Blue/green migration checklist:**
- [ ] All `Microsoft.App/containerApps` — update `environmentId` to reference new environment
- [ ] Environment certificates and custom domains — recreate on new environment
- [ ] Environment storage mounts — recreate on new environment
- [ ] Dapr components — recreate on new environment
- [ ] Any other environment-scoped resources

> ⚠️ Bicep does NOT automatically cascade-recreate apps when the environment changes. You must explicitly patch each app's `environmentId` reference.

---

## Patch 5: Container Apps — Liveness & Readiness Probes

**Find:** `Microsoft.App/containerApps`

**Search pattern:** `resource .* 'Microsoft.App/containerApps@`

**Add probes to the container template:**

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  properties: {
    environmentId: containerAppEnv.id
    template: {
      containers: [
        {
          name: 'main'
          image: imageName
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          // ← ADD probes
          probes: [
            {
              type: 'liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              periodSeconds: 10
              failureThreshold: 3
            }
            {
              type: 'readiness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              periodSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 2  // ← ensure ≥2 for zone redundancy
      }
    }
  }
}
```

---

## Patch Summary Checklist

Before completing IaC patching, verify all applicable patches:

| # | Resource | Property | Value |
|---|----------|----------|-------|
| 1 | `Microsoft.Web/serverfarms` | `properties.zoneRedundant` | `true` |
| 2 | `Microsoft.Web/serverfarms` (Premium) | `sku.capacity` | `≥ 2` |
| 3 | `Microsoft.Web/sites` (Premium) | `siteConfig.minimumElasticInstanceCount` | `≥ 2` |
| 4 | `Microsoft.Storage/storageAccounts` | `sku.name` | `'Standard_ZRS'` |
| 5 | `Microsoft.Web/sites` (Premium/Dedicated) | `siteConfig.healthCheckPath` | `'/api/health'` |
| 6 | `Microsoft.App/managedEnvironments` | `properties.zoneRedundant` | `true` |
| 7 | `Microsoft.App/containerApps` | `template.containers[].probes` | liveness + readiness |
| 8 | `Microsoft.App/containerApps` | `template.scale.minReplicas` | `≥ 2` |

After patching, tell the user:
```
✅ Bicep files patched for reliability. Run `azd up` to deploy with these changes.

⚠️ Note: If you have an existing Container Apps environment without zone redundancy,
   the environment name was changed to force recreation. Your apps will be migrated
   to the new environment on next deploy.
```
