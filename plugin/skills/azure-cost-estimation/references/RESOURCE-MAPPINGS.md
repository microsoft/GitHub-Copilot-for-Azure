# Azure Resource Type to Pricing API Mappings

This document maps Azure resource types (as used in Bicep/ARM templates) to the Azure Retail Prices API service names.

## Maintenance Note

These mappings are based on stable Azure resource provider naming conventions and rarely change. However, updates may be needed when:

- **New resource types are added to Azure** - New services or resource types are introduced
- **Service names change in the Pricing API** - Rare, but service names may be updated
- **SKU patterns change** - New VM families or SKU naming conventions are introduced

**Recommended review frequency:** Quarterly, or when new Azure services are used in templates.

The Azure Retail Prices API itself is stable - the mappings here help translate ARM resource types to the correct `serviceName` filter for the API.

## Compute Resources

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.Compute/virtualMachines` | Virtual Machines | `properties.hardwareProfile.vmSize` | Filter by Windows/Linux via productName |
| `Microsoft.Compute/virtualMachineScaleSets` | Virtual Machines | `sku.name` | Multiply by capacity |
| `Microsoft.Compute/disks` | Managed Disks | `sku.name` | P10, P20, S10, etc. |

## Container Services

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.ContainerService/managedClusters` | Azure Kubernetes Service | `agentPoolProfiles[].vmSize` | Per-node VM pricing |
| `Microsoft.App/containerApps` | Azure Container Apps | `template.containers[].resources` | vCPU + memory based |
| `Microsoft.App/managedEnvironments` | Azure Container Apps | N/A | Environment has separate costs |
| `Microsoft.ContainerRegistry/registries` | Container Registry | `sku.name` | Basic, Standard, Premium |
| `Microsoft.ContainerInstance/containerGroups` | Container Instances | `containers[].resources` | vCPU + memory based |

## Storage

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.Storage/storageAccounts` | Storage | `sku.name` | Standard_LRS, Premium_LRS, etc. |
| `Microsoft.Storage/storageAccounts/blobServices` | Storage | Parent SKU | Per-GB pricing |
| `Microsoft.Storage/storageAccounts/fileServices` | Storage | Parent SKU | Per-GB pricing |

## Databases

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.Sql/servers/databases` | SQL Database | `sku.name` | GP_S_Gen5_2, BC_Gen5_4, etc. |
| `Microsoft.Sql/servers/elasticPools` | SQL Database | `sku.name` | Pool-based pricing |
| `Microsoft.DBforPostgreSQL/flexibleServers` | Azure Database for PostgreSQL | `sku.name` | Standard_D2s_v3, etc. |
| `Microsoft.DBforMySQL/flexibleServers` | Azure Database for MySQL | `sku.name` | Standard_D2s_v3, etc. |
| `Microsoft.DocumentDB/databaseAccounts` | Azure Cosmos DB | `capacity` | RU-based pricing |
| `Microsoft.Cache/Redis` | Azure Cache for Redis | `sku.name` | C0, C1, P1, etc. |

## Web & App Services

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.Web/serverfarms` | Azure App Service | `sku.name` | F1, B1, S1, P1V2, etc. |
| `Microsoft.Web/sites` | Azure App Service | Via serverfarm | Linked to App Service Plan |
| `Microsoft.Web/sites/slots` | Azure App Service | Via serverfarm | Slot has separate costs on Standard+ |

## Networking

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.Network/virtualNetworks` | Virtual Network | N/A | Free (VNet peering costs extra) |
| `Microsoft.Network/publicIPAddresses` | Virtual Network | `sku.name` | Basic (free), Standard |
| `Microsoft.Network/loadBalancers` | Load Balancer | `sku.name` | Basic (free), Standard |
| `Microsoft.Network/applicationGateways` | Application Gateway | `sku.name` | Standard_v2, WAF_v2 |
| `Microsoft.Network/virtualNetworkGateways` | VPN Gateway | `sku.name` | VpnGw1, VpnGw2, etc. |
| `Microsoft.Network/azureFirewalls` | Azure Firewall | `sku.name` | Standard, Premium |
| `Microsoft.Cdn/profiles` | Content Delivery Network | `sku.name` | Standard_Microsoft, etc. |

## Security & Identity

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.KeyVault/vaults` | Key Vault | `sku.name` | Standard, Premium |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | N/A | N/A | Free |

## Monitoring & Management

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.OperationalInsights/workspaces` | Log Analytics | `sku.name` | Per-GB pricing |
| `Microsoft.Insights/components` | Application Insights | N/A | Per-GB data ingestion |
| `Microsoft.Insights/actionGroups` | Azure Monitor | N/A | Per notification |

## Messaging & Events

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.ServiceBus/namespaces` | Service Bus | `sku.name` | Basic, Standard, Premium |
| `Microsoft.EventHub/namespaces` | Event Hubs | `sku.name` | Basic, Standard, Premium |
| `Microsoft.EventGrid/topics` | Event Grid | N/A | Per-operation pricing |

## AI & Cognitive Services

| Resource Type | API Service Name | SKU Location | Notes |
|---------------|-----------------|--------------|-------|
| `Microsoft.CognitiveServices/accounts` | Cognitive Services | `sku.name` | Per-API pricing |
| `Microsoft.MachineLearningServices/workspaces` | Machine Learning | `sku.name` | Compute-based pricing |

## Free Resources (No Direct Cost)

These resource types typically have no direct cost:

- `Microsoft.Network/virtualNetworks` - VNet is free
- `Microsoft.Network/networkInterfaces` - NICs are free
- `Microsoft.Network/networkSecurityGroups` - NSGs are free
- `Microsoft.ManagedIdentity/userAssignedIdentities` - Managed identities are free
- `Microsoft.Authorization/roleAssignments` - RBAC assignments are free
- `Microsoft.Resources/deployments` - Deployments are free

## Common SKU Patterns

### Virtual Machine Sizes
```
Standard_D4s_v3    - General purpose, 4 vCPU
Standard_E8s_v3    - Memory optimized, 8 vCPU
Standard_F4s_v2    - Compute optimized, 4 vCPU
Standard_B2s       - Burstable, 2 vCPU
Standard_NC6       - GPU, 6 vCPU + 1 GPU
```

### Storage SKUs
```
Standard_LRS       - Locally redundant
Standard_GRS       - Geo-redundant
Standard_ZRS       - Zone-redundant
Premium_LRS        - Premium SSD, locally redundant
```

### App Service SKUs
```
F1                 - Free tier
D1                 - Shared
B1, B2, B3         - Basic
S1, S2, S3         - Standard
P1V2, P2V2, P3V2   - Premium V2
P1V3, P2V3, P3V3   - Premium V3
```

### SQL Database SKUs
```
GP_S_Gen5_2        - General Purpose Serverless, 2 vCores
GP_Gen5_4          - General Purpose Provisioned, 4 vCores
BC_Gen5_4          - Business Critical, 4 vCores
HS_Gen5_8          - Hyperscale, 8 vCores
Basic              - Basic tier (5 DTUs)
S0, S1, S2         - Standard tier (10-50 DTUs)
P1, P2, P4         - Premium tier (125-500 DTUs)
```

## API Query Examples

### Virtual Machine
```
armSkuName eq 'Standard_D4s_v3' and armRegionName eq 'eastus' and serviceName eq 'Virtual Machines' and priceType eq 'Consumption'
```

### Storage Account
```
serviceName eq 'Storage' and armRegionName eq 'eastus' and contains(skuName, 'Standard LRS')
```

### SQL Database
```
armSkuName eq 'GP_S_Gen5_2' and armRegionName eq 'eastus' and serviceName eq 'SQL Database'
```

### App Service
```
serviceName eq 'Azure App Service' and armRegionName eq 'eastus' and contains(skuName, 'P1')
```
