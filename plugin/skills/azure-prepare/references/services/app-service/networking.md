# App Service Networking

VNet integration, Private Endpoints, Access Restrictions, and Hybrid Connections.

## Feature Availability by SKU

| Feature | Free/Basic | Standard | Premium | Isolated |
|---------|:-:|:-:|:-:|:-:|
| VNet integration (outbound) | ❌ | ✅ | ✅ | ✅ (native) |
| Private Endpoints (inbound) | ❌ | ❌ | ✅ | ✅ |
| Access Restrictions | ✅ | ✅ | ✅ | ✅ |
| Hybrid Connections | ❌ | 25 | 200 | 200 |
| Service Endpoints | ❌ | ✅ | ✅ | ✅ |

## VNet Integration (Outbound)

Routes outbound traffic from the app through a VNet subnet, enabling access to private resources (databases, storage, VMs).

### Subnet Requirements

| Requirement | Value |
|------------|-------|
| Minimum subnet size | `/26` (64 addresses) recommended |
| Delegation | `Microsoft.Web/serverFarms` |
| Dedicated | One subnet per App Service plan |

### Bicep — VNet Integration

```bicep
resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: vnet
  name: 'app-service-subnet'
  properties: {
    addressPrefix: '10.0.1.0/26'
    delegations: [
      {
        name: 'Microsoft.Web.serverFarms'
        properties: { serviceName: 'Microsoft.Web/serverFarms' }
      }
    ]
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    virtualNetworkSubnetId: subnet.id
    vnetRouteAllEnabled: true // route all outbound through VNet
  }
}
```

> 💡 **Tip:** Set `vnetRouteAllEnabled: true` to route ALL outbound traffic through the VNet. Without this, only RFC1918 traffic is routed through the VNet.

## Private Endpoints (Inbound)

Expose the app on a private IP address within your VNet. Public access can be disabled entirely.

### Bicep — Private Endpoint

```bicep
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${appName}-pe'
  location: location
  properties: {
    subnet: { id: privateEndpointSubnet.id }
    privateLinkServiceConnections: [
      {
        name: '${appName}-connection'
        properties: {
          privateLinkServiceId: webApp.id
          groupIds: ['sites']
        }
      }
    ]
  }
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.azurewebsites.net'
  location: 'global'
}

resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: '${vnet.name}-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}
```

> ⚠️ **Warning:** Private Endpoints require Premium (P1v3+) or Isolated tier. The private DNS zone `privatelink.azurewebsites.net` must be linked to the VNet for name resolution.

## Access Restrictions

Control inbound access with IP-based or service-tag rules. Available on all SKUs.

### Bicep — Access Restrictions

```bicep
siteConfig: {
  ipSecurityRestrictions: [
    {
      name: 'allow-office'
      priority: 100
      action: 'Allow'
      ipAddress: '203.0.113.0/24'
    }
    {
      name: 'deny-all'
      priority: 2147483647
      action: 'Deny'
      ipAddress: 'Any'
    }
  ]
  scmIpSecurityRestrictionsUseMain: true
}
```

> 💡 **Tip:** Always restrict the SCM/Kudu site too. Use `scmIpSecurityRestrictionsUseMain: true` to inherit main site rules, or define separate SCM rules.

## Hybrid Connections

Connect to on-premises resources without VPN. Requires Standard tier or higher. Uses Hybrid Connection Manager (HCM) agent on-premises relaying through Azure Relay.

> ⚠️ **Warning:** Each Hybrid Connection maps to a single host:port endpoint. Standard tier supports 25; Premium/Isolated support 200.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Cannot reach private DB | VNet integration not enabled | Enable VNet integration; check `vnetRouteAllEnabled` |
| DNS resolution fails | Private DNS zone not linked | Link `privatelink.*` DNS zone to VNet |
| Access restriction not working | Priority ordering wrong | Lower numbers = higher priority; check rule order |
| Hybrid Connection timeout | HCM not running | Verify HCM service status on-premises |
| Outbound traffic blocked | NSG rules on subnet | Allow outbound to required services in NSG |
