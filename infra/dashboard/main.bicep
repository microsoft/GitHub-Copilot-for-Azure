// Integration Test Dashboard Infrastructure
// Deploys: Azure PostgreSQL Flexible Server + Azure Static Web App
//
// Usage:
//   az deployment group create \
//     --resource-group rg-test-dashboard \
//     --template-file main.bicep \
//     --parameters administratorLogin=dashboardadmin

targetScope = 'resourceGroup'

@description('Location for all resources')
param location string = resourceGroup().location

@description('PostgreSQL administrator login name')
param administratorLogin string

@description('PostgreSQL administrator password')
@secure()
param administratorPassword string

@description('PostgreSQL server name')
param serverName string = 'psql-test-dashboard'

@description('Static Web App name')
param swaName string = 'swa-test-dashboard'

@description('PostgreSQL SKU name (e.g., Standard_B1ms for burstable)')
param postgresSku string = 'Standard_B1ms'

@description('PostgreSQL storage size in GB')
param postgresStorageGb int = 32

// --- PostgreSQL Flexible Server ---
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: postgresSku
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: postgresStorageGb
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresServer
  name: 'testdashboard'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow Azure services to connect
resource postgresFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// --- Static Web App ---
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: '/dashboard'
      apiLocation: '/dashboard/api'
      outputLocation: 'dist'
    }
  }
}

// --- Outputs ---
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDbName string = postgresDb.name
output swaDefaultHostname string = staticWebApp.properties.defaultHostname
output swaId string = staticWebApp.id
