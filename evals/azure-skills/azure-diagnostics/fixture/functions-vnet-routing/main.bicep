param location string
param testPrincipalId string

var suffix = uniqueString(resourceGroup().id)
var roleDefinitions = {
  storageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  storageBlobDataReader: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  storageQueueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  storageTableDataContributor: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
}

resource routeTable 'Microsoft.Network/routeTables@2024-05-01' = {
  name: 'fnrt-routes-${suffix}'
  location: location
  properties: {
    disableBgpRoutePropagation: false
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'fnrt-vnet-${suffix}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
  }
}

resource integrationSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: vnet
  name: 'functions-integration'
  properties: {
    addressPrefix: '10.42.1.0/26'
    routeTable: {
      id: routeTable.id
    }
    delegations: [
      {
        name: 'flex-consumption'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
  }
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: vnet
  name: 'private-endpoints'
  properties: {
    addressPrefix: '10.42.2.0/27'
    privateEndpointNetworkPolicies: 'RouteTableEnabled'
  }
}

resource hostStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'fnrthost${suffix}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource hostBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: hostStorage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: hostBlobService
  name: 'deploymentpackage'
}

resource testStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'fnrtdata${suffix}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource testBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: testStorage
  name: 'default'
}

resource testDataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: testBlobService
  name: 'testdata'
  properties: {
    publicAccess: 'None'
  }
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'fnrt-logs-${suffix}'
  location: location
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'fnrt-insights-${suffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'fnrt-plan-${suffix}'
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: 'fnrt-app-${suffix}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    DiagnosticScenario: 'FlexVnetStorageRoute'
    ExpectedIntegrationSubnetId: integrationSubnet.id
    ExpectedPrivateEndpointSubnetId: privateEndpointSubnet.id
    ExpectedTestStorageResourceId: testStorage.id
  }
  properties: {
    serverFarmId: plan.id
    virtualNetworkSubnetId: integrationSubnet.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${hostStorage.properties.primaryEndpoints.blob}${deploymentContainer.name}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 20
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
    siteConfig: {
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: hostStorage.properties.primaryEndpoints.blob
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: hostStorage.properties.primaryEndpoints.queue
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: hostStorage.properties.primaryEndpoints.table
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'TEST_STORAGE_BLOB_URL'
          value: '${testStorage.properties.primaryEndpoints.blob}${testDataContainer.name}/sample.txt'
        }
        {
          name: 'TEST_STORAGE_HOSTNAME'
          value: '${testStorage.name}.blob.${environment().suffixes.storage}'
        }
      ]
    }
  }
}

resource hostBlobOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(hostStorage.id, functionApp.id, 'Storage Blob Data Owner')
  scope: hostStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitions.storageBlobDataOwner)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource hostQueueContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(hostStorage.id, functionApp.id, 'Storage Queue Data Contributor')
  scope: hostStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitions.storageQueueDataContributor)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource hostTableContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(hostStorage.id, functionApp.id, 'Storage Table Data Contributor')
  scope: hostStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitions.storageTableDataContributor)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource testStorageReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(testStorage.id, functionApp.id, 'Storage Blob Data Reader')
  scope: testStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitions.storageBlobDataReader)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource fixtureWriter 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(testStorage.id, testPrincipalId, 'Storage Blob Data Contributor')
  scope: testStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitions.storageBlobDataContributor)
    principalId: testPrincipalId
  }
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
}

resource privateDnsVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: privateDnsZone
  name: 'fnrt-link-${suffix}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource testStoragePrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'fnrt-storage-pe-${suffix}'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnet.id
    }
    privateLinkServiceConnections: [
      {
        name: 'blob'
        properties: {
          groupIds: [
            'blob'
          ]
          privateLinkServiceConnectionState: {
            description: 'Auto-approved test fixture'
            status: 'Approved'
          }
          privateLinkServiceId: testStorage.id
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: testStoragePrivateEndpoint
  name: 'blob'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
  dependsOn: [
    privateDnsVnetLink
  ]
}
