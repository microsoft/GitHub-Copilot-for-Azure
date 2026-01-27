# Azure Verified Modules Reference

Pre-built, Microsoft-maintained Bicep modules for common Azure resources.

---

## Overview

Azure Verified Modules (AVM) provide:
- Consistent, well-tested infrastructure patterns
- Built-in best practices (security, networking, monitoring)
- Semantic versioning for stability
- Both Bicep and Terraform formats

**Registry:** `br/public:avm/res/<provider>/<resource>:<version>`

---

## Quick Usage

```bicep
// Reference AVM module
module storage 'br/public:avm/res/storage/storage-account:0.9.0' = {
  name: 'storage'
  scope: resourceGroup
  params: {
    name: 'mystorageaccount'
    location: location
    skuName: 'Standard_LRS'
  }
}
```

---

## Web & Compute Modules

### App Service (Web App)

```bicep
module appService 'br/public:avm/res/web/site:0.3.0' = {
  name: 'appService'
  params: {
    name: 'mywebapp'
    location: location
    kind: 'app,linux'
    serverFarmResourceId: appServicePlan.outputs.resourceId
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
    }
    appSettingsKeyValuePairs: {
      NODE_ENV: 'production'
      DATABASE_URL: cosmosDb.outputs.connectionString
    }
  }
}
```

### App Service Plan

```bicep
module appServicePlan 'br/public:avm/res/web/serverfarm:0.2.0' = {
  name: 'appServicePlan'
  params: {
    name: 'myplan'
    location: location
    skuName: 'B1'
    skuCapacity: 1
    kind: 'linux'
    reserved: true  // Required for Linux
  }
}
```

### Static Web App

```bicep
module staticWebApp 'br/public:avm/res/web/static-site:0.3.0' = {
  name: 'staticWebApp'
  params: {
    name: 'myswa'
    location: location
    sku: 'Free'
    stagingEnvironmentPolicy: 'Enabled'
  }
}
```

### Function App

```bicep
module functionApp 'br/public:avm/res/web/site:0.3.0' = {
  name: 'functionApp'
  params: {
    name: 'myfunc'
    location: location
    kind: 'functionapp,linux'
    serverFarmResourceId: consumptionPlan.outputs.resourceId
    siteConfig: {
      linuxFxVersion: 'Node|20'
    }
    appSettingsKeyValuePairs: {
      FUNCTIONS_WORKER_RUNTIME: 'node'
      FUNCTIONS_EXTENSION_VERSION: '~4'
      AzureWebJobsStorage: storageAccount.outputs.primaryConnectionString
    }
  }
}
```

### Container App

```bicep
module containerApp 'br/public:avm/res/app/container-app:0.4.0' = {
  name: 'containerApp'
  params: {
    name: 'mycontainerapp'
    location: location
    environmentId: containerAppEnv.outputs.resourceId
    containers: [{
      name: 'main'
      image: 'nginx:latest'
      resources: {
        cpu: '0.5'
        memory: '1Gi'
      }
    }]
    ingress: {
      external: true
      targetPort: 80
    }
  }
}
```

### Container Apps Environment

```bicep
module containerAppEnv 'br/public:avm/res/app/managed-environment:0.5.0' = {
  name: 'containerAppEnv'
  params: {
    name: 'myenv'
    location: location
    logAnalyticsWorkspaceResourceId: logAnalytics.outputs.resourceId
  }
}
```

---

## Database Modules

### Cosmos DB

```bicep
module cosmosDb 'br/public:avm/res/document-db/database-account:0.4.0' = {
  name: 'cosmosDb'
  params: {
    name: 'mycosmos'
    location: location
    locations: [{
      locationName: location
      failoverPriority: 0
      isZoneRedundant: false
    }]
    sqlDatabases: [{
      name: 'mydb'
      containers: [{
        name: 'items'
        partitionKeyPath: '/partitionKey'
        indexingPolicy: {
          automatic: true
          indexingMode: 'consistent'
        }
      }]
    }]
  }
}
```

### Azure SQL

```bicep
module sqlServer 'br/public:avm/res/sql/server:0.4.0' = {
  name: 'sqlServer'
  params: {
    name: 'mysqlserver'
    location: location
    administratorLogin: 'adminuser'
    administratorLoginPassword: sqlPassword
    databases: [{
      name: 'mydb'
      sku: {
        name: 'S0'
        tier: 'Standard'
      }
    }]
  }
}
```

### PostgreSQL Flexible Server

```bicep
module postgres 'br/public:avm/res/db-for-postgre-sql/flexible-server:0.1.0' = {
  name: 'postgres'
  params: {
    name: 'mypostgres'
    location: location
    skuName: 'Standard_B1ms'
    tier: 'Burstable'
    administratorLogin: 'adminuser'
    administratorLoginPassword: pgPassword
    storageSizeGB: 32
    databases: [{
      name: 'mydb'
    }]
  }
}
```

---

## Storage Modules

### Storage Account

```bicep
module storage 'br/public:avm/res/storage/storage-account:0.9.0' = {
  name: 'storage'
  params: {
    name: 'mystorageacct'
    location: location
    skuName: 'Standard_LRS'
    kind: 'StorageV2'
    blobServices: {
      containers: [{
        name: 'uploads'
        publicAccess: 'None'
      }]
    }
  }
}
```

---

## Caching & Messaging

### Redis Cache

```bicep
module redis 'br/public:avm/res/cache/redis:0.3.0' = {
  name: 'redis'
  params: {
    name: 'myredis'
    location: location
    skuName: 'Basic'
    capacity: 0
    enableNonSslPort: false
  }
}
```

### Service Bus

```bicep
module serviceBus 'br/public:avm/res/service-bus/namespace:0.6.0' = {
  name: 'serviceBus'
  params: {
    name: 'myservicebus'
    location: location
    skuName: 'Standard'
    queues: [{
      name: 'orders'
      maxSizeInMegabytes: 1024
    }]
    topics: [{
      name: 'events'
      subscriptions: [{
        name: 'processor'
      }]
    }]
  }
}
```

### Event Hub

```bicep
module eventHub 'br/public:avm/res/event-hub/namespace:0.4.0' = {
  name: 'eventHub'
  params: {
    name: 'myeventhub'
    location: location
    skuName: 'Standard'
    eventhubs: [{
      name: 'telemetry'
      partitionCount: 4
      messageRetentionInDays: 1
    }]
  }
}
```

---

## Security & Identity

### Key Vault

```bicep
module keyVault 'br/public:avm/res/key-vault/vault:0.6.0' = {
  name: 'keyVault'
  params: {
    name: 'mykeyvault'
    location: location
    sku: 'standard'
    enableRbacAuthorization: true
    secrets: [{
      name: 'database-password'
      value: dbPassword
    }]
  }
}
```

### Managed Identity

```bicep
module managedIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.2.0' = {
  name: 'managedIdentity'
  params: {
    name: 'myidentity'
    location: location
  }
}
```

---

## Monitoring

### Log Analytics Workspace

```bicep
module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.4.0' = {
  name: 'logAnalytics'
  params: {
    name: 'myloganalytics'
    location: location
    skuName: 'PerGB2018'
    retentionInDays: 30
  }
}
```

### Application Insights

```bicep
module appInsights 'br/public:avm/res/insights/component:0.3.0' = {
  name: 'appInsights'
  params: {
    name: 'myappinsights'
    location: location
    kind: 'web'
    workspaceResourceId: logAnalytics.outputs.resourceId
  }
}
```

---

## Networking

### Virtual Network

```bicep
module vnet 'br/public:avm/res/network/virtual-network:0.1.0' = {
  name: 'vnet'
  params: {
    name: 'myvnet'
    location: location
    addressPrefixes: ['10.0.0.0/16']
    subnets: [
      {
        name: 'app'
        addressPrefix: '10.0.1.0/24'
      }
      {
        name: 'data'
        addressPrefix: '10.0.2.0/24'
      }
    ]
  }
}
```

---

## Complete Example: Web + API + DB

```bicep
targetScope = 'subscription'

param environmentName string
param location string

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// App Service Plan
module plan 'br/public:avm/res/web/serverfarm:0.2.0' = {
  scope: rg
  name: 'plan'
  params: {
    name: 'plan-${resourceToken}'
    location: location
    skuName: 'B1'
    kind: 'linux'
    reserved: true
  }
}

// Static Web App for frontend
module web 'br/public:avm/res/web/static-site:0.3.0' = {
  scope: rg
  name: 'web'
  params: {
    name: 'web-${resourceToken}'
    location: location
    sku: 'Free'
  }
}

// App Service for API
module api 'br/public:avm/res/web/site:0.3.0' = {
  scope: rg
  name: 'api'
  params: {
    name: 'api-${resourceToken}'
    location: location
    kind: 'app,linux'
    serverFarmResourceId: plan.outputs.resourceId
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
    }
    appSettingsKeyValuePairs: {
      COSMOS_CONNECTION: cosmos.outputs.connectionStrings[0].connectionString
      COSMOS_DATABASE: 'appdb'
    }
  }
}

// Cosmos DB
module cosmos 'br/public:avm/res/document-db/database-account:0.4.0' = {
  scope: rg
  name: 'cosmos'
  params: {
    name: 'cosmos-${resourceToken}'
    location: location
    locations: [{ locationName: location, failoverPriority: 0 }]
    sqlDatabases: [{
      name: 'appdb'
      containers: [{ name: 'items', partitionKeyPath: '/id' }]
    }]
  }
}

output WEB_URI string = 'https://${web.outputs.defaultHostname}'
output API_URI string = 'https://${api.outputs.defaultHostname}'
```

---

## Finding Modules

- **Browse:** https://azure.github.io/Azure-Verified-Modules/
- **GitHub:** https://github.com/Azure/bicep-registry-modules
- **List in Bicep:**
  ```bash
  az bicep list-versions --target br/public:avm/res/web/site
  ```
