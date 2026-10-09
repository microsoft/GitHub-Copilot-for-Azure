param location string
param suffix string
param abbrs object

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${abbrs.managedIdentities}${suffix}'
  location: location
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: '${abbrs.containerRegistries}${suffix}'
  location: location
  sku: {
    name: 'Basic'
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, 'AcrPull')
  scope: registry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
  }
}

resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${abbrs.managedEnvironments}${suffix}'
  location: location
  properties: {}
}

resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${abbrs.containerApps}${suffix}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${registry.properties.loginServer}/web:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
}

output WEB_URL string = 'https://${app.properties.configuration.ingress.fqdn}'
