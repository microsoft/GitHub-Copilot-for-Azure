# Azure Compute & Container Resource Configuration Reference

ARM property retrieval mapping for compute and container resources. Used by [azure-resource-configs.md](azure-resource-configs.md).

---

### Microsoft.Compute/virtualMachines

**MCP Tool**: `mcp_azure_mcp_compute`
**Fallback**: `az vm show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| vmSize | `properties.hardwareProfile.vmSize` | |
| osType | `properties.storageProfile.osDisk.osType` | |
| osImage | *(composite — see Composite Property Rules in azure-resource-configs.md)* | |
| osDiskType | `properties.storageProfile.osDisk.managedDisk.storageAccountType` | |
| osDiskSizeGB | `properties.storageProfile.osDisk.diskSizeGB` | |
| dataDisks | `properties.storageProfile.dataDisks` | Array |
| adminUsername | `properties.osProfile.adminUsername` | |
| authenticationType | `properties.osProfile.linuxConfiguration.disablePasswordAuthentication` | `true` → `sshPublicKey`, `false` → `password` |
| enableBootDiagnostics | `properties.diagnosticsProfile.bootDiagnostics.enabled` | |
| availabilityZone | `zones[0]` | Top-level `zones` array |
| enableAcceleratedNetworking | *(from NIC resource)* | Query linked NIC via `properties.networkProfile.networkInterfaces[0].id` |

### Microsoft.Compute/virtualMachineScaleSets

**MCP Tool**: `mcp_azure_mcp_compute`
**Fallback**: `az vmss show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| vmSize | `sku.name` | In `sku` not `properties` |
| capacity | `sku.capacity` | |
| osImage | *(composite from `properties.virtualMachineProfile.storageProfile.imageReference`)* | |
| upgradePolicy | `properties.upgradePolicy.mode` | |

### Microsoft.ContainerService/managedClusters

**MCP Tool**: `mcp_azure_mcp_aks`
**Fallback**: `az aks show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| kubernetesVersion | `properties.kubernetesVersion` | |
| defaultNodePoolVmSize | `properties.agentPoolProfiles[0].vmSize` | First pool |
| defaultNodePoolCount | `properties.agentPoolProfiles[0].count` | First pool |
| networkPlugin | `properties.networkProfile.networkPlugin` | |
| networkPolicy | `properties.networkProfile.networkPolicy` | |
| enableRBAC | `properties.enableRBAC` | |
| enableManagedIdentity | *(derived)* | `true` if `identity.type` contains `SystemAssigned` or `UserAssigned` |

### Microsoft.App/managedEnvironments

**MCP Tool**: `mcp_azure_mcp_containerapps`
**Fallback**: `az containerapp env show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| workloadProfileType | `properties.workloadProfiles[0].workloadProfileType` | |
| zoneRedundant | `properties.zoneRedundant` | |

### Microsoft.App/containerApps

**MCP Tool**: `mcp_azure_mcp_containerapps`
**Fallback**: `az containerapp show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| containerImage | `properties.template.containers[0].image` | First container |
| cpuCores | `properties.template.containers[0].resources.cpu` | |
| memoryGi | `properties.template.containers[0].resources.memory` | Strip `Gi` suffix |
| minReplicas | `properties.template.scale.minReplicas` | |
| maxReplicas | `properties.template.scale.maxReplicas` | |
| targetPort | `properties.configuration.ingress.targetPort` | |
| external | `properties.configuration.ingress.external` | |

### Microsoft.ContainerRegistry/registries

**MCP Tool**: `mcp_azure_mcp_acr`
**Fallback**: `az acr show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| adminUserEnabled | `properties.adminUserEnabled` | |
| publicNetworkAccess | `properties.publicNetworkAccess` | |

### Microsoft.Insights/components

**MCP Tool**: `mcp_azure_mcp_applicationinsights`
**Fallback**: `az monitor app-insights component show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| applicationType | `properties.Application_Type` | |
| retentionInDays | `properties.RetentionInDays` | |
| ingestionMode | `properties.IngestionMode` | |

### Microsoft.OperationalInsights/workspaces

**MCP Tool**: `mcp_azure_mcp_monitor`
**Fallback**: `az monitor log-analytics workspace show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | Nested under `properties.sku` |
| retentionInDays | `properties.retentionInDays` | |
