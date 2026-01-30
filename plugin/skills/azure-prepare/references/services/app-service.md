# Azure App Service

Hosting patterns and best practices for Azure App Service.

## When to Use

- Traditional web applications
- REST APIs without containerization
- .NET, Node.js, Python, Java, PHP applications
- When Docker is not required/desired
- When built-in deployment slots are needed

## Service Type in azure.yaml

```yaml
services:
  my-web:
    host: appservice
    project: ./src/my-web
```

## Bicep Resource Pattern

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-plan-${uniqueHash}'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true  // Linux
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: true
      healthCheckPath: '/health'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
      ]
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| App Service Plan | Compute hosting |
| Application Insights | Monitoring |
| Key Vault | Secrets (optional) |

## Runtime Stacks

| Language | linuxFxVersion |
|----------|----------------|
| Node.js 18 | `NODE\|18-lts` |
| Node.js 20 | `NODE\|20-lts` |
| Python 3.11 | `PYTHON\|3.11` |
| .NET 8 | `DOTNETCORE\|8.0` |
| Java 17 | `JAVA\|17-java17` |

## SKU Selection

| SKU | Use Case |
|-----|----------|
| F1/D1 | Development/testing (free/shared) |
| B1-B3 | Small production, basic features |
| S1-S3 | Production with auto-scale, slots |
| P1v3-P3v3 | High-performance production |

## Key Vault Integration

Reference secrets from Key Vault:

```bicep
appSettings: [
  {
    name: 'DATABASE_URL'
    value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=database-url)'
  }
]
```

## Deployment Slots

For zero-downtime deployments:

```bicep
resource stagingSlot 'Microsoft.Web/sites/slots@2022-09-01' = {
  parent: webApp
  name: 'staging'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
  }
}
```

## Auto-scaling

```bicep
resource autoScale 'Microsoft.Insights/autoscalesettings@2022-10-01' = {
  name: '${webApp.name}-autoscale'
  location: location
  properties: {
    targetResourceUri: appServicePlan.id
    enabled: true
    profiles: [
      {
        name: 'Auto scale'
        capacity: {
          minimum: '1'
          maximum: '10'
          default: '1'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
        ]
      }
    ]
  }
}
```

## Health Checks

Always configure health check path:

```bicep
siteConfig: {
  healthCheckPath: '/health'
}
```

Endpoint should return 200 OK when healthy.
