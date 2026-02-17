// recipes/cosmosdb/bicep/cosmos.bicep
// Cosmos DB recipe module — adds Cosmos DB account, database, containers, and RBAC
// to an Azure Functions base template.
//
// USAGE: Add this as a module in your main.bicep:
//   module cosmos './app/cosmos.bicep' = {
//     name: 'cosmos'
//     scope: rg
//     params: {
//       name: name
//       location: location
//       tags: tags
//       functionAppPrincipalId: app.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
//     }
//   }

targetScope = 'resourceGroup'

@description('Base name for resources')
param name string

@description('Azure region')
param location string = resourceGroup().location

@description('Resource tags')
param tags object = {}

@description('Principal ID of the Function App managed identity')
param functionAppPrincipalId string

@description('Database name')
param databaseName string = 'documents-db'

@description('Container name')
param containerName string = 'documents'

@description('Leases container name')
param leasesContainerName string = 'leases'

// ============================================================================
// Naming
// ============================================================================
var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, name), 6)
var cosmosAccountName = 'cosmos-${name}-${resourceSuffix}'

// ============================================================================
// Cosmos DB Account (Serverless)
// ============================================================================
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

// ============================================================================
// Database
// ============================================================================
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// ============================================================================
// Containers
// ============================================================================
resource dataContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/*' }
        ]
      }
    }
  }
}

resource leasesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: leasesContainerName
  properties: {
    resource: {
      id: leasesContainerName
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
    }
  }
}

// ============================================================================
// RBAC: Azure Control Plane — Cosmos DB Account Reader
// ============================================================================
resource cosmosAccountReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cosmosAccount.id, functionAppPrincipalId, 'fbdf93bf-df7d-467e-a4d2-9458aa1360c8')
  scope: cosmosAccount
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'fbdf93bf-df7d-467e-a4d2-9458aa1360c8' // Cosmos DB Account Reader Role
    )
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// RBAC: Cosmos Data Plane — SQL Data Contributor
// (Cosmos DB uses its own role system for data operations)
// ============================================================================
resource cosmosSqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, functionAppPrincipalId, '00000000-0000-0000-0000-000000000002')
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: functionAppPrincipalId
    scope: cosmosAccount.id
  }
}

// ============================================================================
// Outputs — consumed by main.bicep to wire into Function App settings
// ============================================================================
output cosmosAccountEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosAccountName string = cosmosAccount.name
output cosmosDatabaseName string = databaseName
output cosmosContainerName string = containerName
