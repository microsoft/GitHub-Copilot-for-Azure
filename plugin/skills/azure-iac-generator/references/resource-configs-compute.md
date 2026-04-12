# Compute Resource Property Mapping

Per-resource property retrieval for compute and container resource types.

**Fallback for all**: `az resource show --ids <resourceId> -o json`

---

### Microsoft.Compute/virtualMachines

**MCP Tool**: `mcp_azure_compute`
**Fallback**: `az vm show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| vmSize | `properties.hardwareProfile.vmSize` | |
| osType | `properties.storageProfile.osDisk.osType` | |
| osImage | *(composite — publisher:offer:sku:version from `storageProfile.imageReference`)* | |
| osDiskType | `properties.storageProfile.osDisk.managedDisk.storageAccountType` | |
| osDiskSizeGB | `properties.storageProfile.osDisk.diskSizeGB` | |
| dataDisks | `properties.storageProfile.dataDisks` | Array |
| adminUsername | `properties.osProfile.adminUsername` | |
| authenticationType | `properties.osProfile.linuxConfiguration.disablePasswordAuthentication` | `true`→`sshPublicKey`, `false`→`password` |
| enableBootDiagnostics | `properties.diagnosticsProfile.bootDiagnostics.enabled` | |
| availabilityZone | `zones[0]` | Top-level `zones` array |
| enableAcceleratedNetworking | *(from NIC resource)* | Query linked NIC via `properties.networkProfile.networkInterfaces[0].id` |

### Microsoft.Compute/virtualMachineScaleSets

**MCP Tool**: `mcp_azure_compute`
**Fallback**: `az vmss show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| vmSize | `sku.name` | In `sku` not `properties` |
| capacity | `sku.capacity` | |
| osImage | *(composite from `properties.virtualMachineProfile.storageProfile.imageReference`)* | |
| upgradePolicy | `properties.upgradePolicy.mode` | |

### Microsoft.Web/serverfarms

**MCP Tool**: `mcp_azure_appservice`
**Fallback**: `az appservice plan show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| skuTier | `sku.tier` | |
| kind | `kind` | Top-level field |
| reserved | `properties.reserved` | |
| capacity | `sku.capacity` | |

### Microsoft.Web/sites

**MCP Tool**: `mcp_azure_appservice`
**Fallback**: `az webapp show --ids <resourceId> -o json` + `az webapp config show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| runtimeStack | `properties.siteConfig.linuxFxVersion` or `windowsFxVersion` | Format: `RUNTIME\|VERSION` |
| httpsOnly | `properties.httpsOnly` | |
| minTlsVersion | `properties.siteConfig.minTlsVersion` | config sub-call |
| alwaysOn | `properties.siteConfig.alwaysOn` | config sub-call |
| http20Enabled | `properties.siteConfig.http20Enabled` | config sub-call |
| ftpsState | `properties.siteConfig.ftpsState` | config sub-call |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
| vnetIntegrationSubnet | `properties.virtualNetworkSubnetId` | |

### Microsoft.Web/sites/functions

**MCP Tool**: `mcp_azure_appservice`
**Fallback**: `az functionapp show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| runtimeStack | `properties.siteConfig.linuxFxVersion` | |
| hostingPlan | *(derived from linked serverfarm SKU)* | |
| httpsOnly | `properties.httpsOnly` | |
| minTlsVersion | `properties.siteConfig.minTlsVersion` | |

### Microsoft.ContainerService/managedClusters

**MCP Tool**: `mcp_azure_aks`
**Fallback**: `az aks show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| kubernetesVersion | `properties.kubernetesVersion` | |
| defaultNodePoolVmSize | `properties.agentPoolProfiles[0].vmSize` | |
| defaultNodePoolCount | `properties.agentPoolProfiles[0].count` | |
| networkPlugin | `properties.networkProfile.networkPlugin` | |
| networkPolicy | `properties.networkProfile.networkPolicy` | |
| enableRBAC | `properties.enableRBAC` | |
| enableManagedIdentity | *(derived)* | `true` if `identity.type` = `SystemAssigned` or `UserAssigned` |

### Microsoft.App/managedEnvironments

**MCP Tool**: `mcp_azure_containerapps`
**Fallback**: `az containerapp env show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| workloadProfileType | `properties.workloadProfiles[0].workloadProfileType` | |
| zoneRedundant | `properties.zoneRedundant` | |

### Microsoft.App/containerApps

**MCP Tool**: `mcp_azure_containerapps`
**Fallback**: `az containerapp show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| containerImage | `properties.template.containers[0].image` | |
| cpuCores | `properties.template.containers[0].resources.cpu` | |
| memoryGi | `properties.template.containers[0].resources.memory` | Strip `Gi` suffix |
| minReplicas | `properties.template.scale.minReplicas` | |
| maxReplicas | `properties.template.scale.maxReplicas` | |
| targetPort | `properties.configuration.ingress.targetPort` | |
| external | `properties.configuration.ingress.external` | |

### Microsoft.ContainerRegistry/registries

**MCP Tool**: `mcp_azure_acr`
**Fallback**: `az acr show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| adminUserEnabled | `properties.adminUserEnabled` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |
