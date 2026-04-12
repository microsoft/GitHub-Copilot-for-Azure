# Azure Network Resource Configuration Reference

ARM property retrieval mapping for Microsoft.Network resources. Used by [azure-resource-configs.md](azure-resource-configs.md).

**MCP Tool**: *(none — use fallback for all network resources)*

---

### Microsoft.Network/virtualNetworks

**Fallback**: `az network vnet show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| addressPrefixes | `properties.addressSpace.addressPrefixes` | Array |
| enableDdosProtection | `properties.enableDdosProtection` | |

### Microsoft.Network/virtualNetworks/subnets

**Fallback**: `az network vnet subnet show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| addressPrefix | `properties.addressPrefix` | |
| serviceEndpoints | `properties.serviceEndpoints` | Array of objects; compare `service` values |
| delegations | `properties.delegations` | Array of objects; compare `serviceName` values |
| privateEndpointNetworkPolicies | `properties.privateEndpointNetworkPolicies` | |

### Microsoft.Network/networkSecurityGroups

**Fallback**: `az network nsg show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| securityRules | `properties.securityRules` | Array; compare rule names and key attributes |

### Microsoft.Network/loadBalancers

**Fallback**: `az network lb show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| type | *(derived)* | Has `properties.frontendIPConfigurations[0].properties.publicIPAddress` → `Public`, else `Internal` |
| frontendPort | `properties.loadBalancingRules[0].properties.frontendPort` | |
| backendPort | `properties.loadBalancingRules[0].properties.backendPort` | |
| protocol | `properties.loadBalancingRules[0].properties.protocol` | |
| enableFloatingIP | `properties.loadBalancingRules[0].properties.enableFloatingIP` | |

### Microsoft.Network/applicationGateways

**Fallback**: `az network application-gateway show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | Nested under `properties.sku` |
| tier | `properties.sku.tier` | Nested under `properties.sku` |
| capacity | `properties.sku.capacity` | Nested under `properties.sku` |
| enableHttp2 | `properties.enableHttp2` | |
| frontendPort | `properties.frontendPorts[0].properties.port` | |

### Microsoft.Network/publicIPAddresses

**Fallback**: `az network public-ip show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |
| allocationMethod | `properties.publicIPAllocationMethod` | |
| availabilityZone | `zones` | Array; `Zone-redundant` if multiple zones listed |

### Microsoft.Network/networkInterfaces

**Fallback**: `az network nic show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| enableAcceleratedNetworking | `properties.enableAcceleratedNetworking` | |
| enableIPForwarding | `properties.enableIPForwarding` | |
| privateIPAllocationMethod | `properties.ipConfigurations[0].properties.privateIPAllocationMethod` | |

### Microsoft.Network/privateEndpoints

**Fallback**: `az network private-endpoint show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| groupIds | `properties.privateLinkServiceConnections[0].properties.groupIds` | Array |
| privateDnsZoneGroup | `properties.privateDnsZoneGroups` | `true` if array is non-empty |

### Microsoft.Network/virtualNetworkGateways

**Fallback**: `az network vnet-gateway show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `properties.sku.name` | Nested under `properties.sku` |
| gatewayType | `properties.gatewayType` | |
| vpnType | `properties.vpnType` | |
| enableBgp | `properties.enableBgp` | |

### Microsoft.Network/azureFirewalls

**Fallback**: `az network firewall show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuTier | `properties.sku.tier` | Nested under `properties.sku` |
| threatIntelMode | `properties.threatIntelMode` | |

### Microsoft.Network/bastionHosts

**Fallback**: `az network bastion show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| skuName | `sku.name` | |

### Microsoft.Network/privateDnsZones

**Fallback**: `az network private-dns zone show --ids <resourceId> -o json`

| Property | ARM JSON Path | Notes |
|----------|---------------|-------|
| zoneName | `name` | Top-level `name` field |
