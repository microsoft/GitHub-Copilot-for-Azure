// fixture-id: enterprise-planner-referenced-v1
targetScope = 'resourceGroup'

param location string = 'eastus2'

resource hubVnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'corp-hub-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: '10.20.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource operationsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'corp-ops-law'
  location: location
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource sharedKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'corp-shared-kv'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: []
    enableRbacAuthorization: true
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
  }
}