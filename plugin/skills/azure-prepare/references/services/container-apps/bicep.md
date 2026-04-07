# Container Apps Bicep Patterns

> **⚠️ Container Registry Naming:** If using Azure Container Registry, names must be alphanumeric only (5-50 characters). Use `replace()` to remove hyphens: `replace('cr${environmentName}${resourceSuffix}', '-', '')`

> **⚠️ Two-Phase Deployment (Mandatory):** To avoid a circular dependency when scoping the AcrPull role assignment to a Bicep module, use the two-phase pattern below:
> - **Phase 1:** Deploy ACR and Container App with a public placeholder image and **no** `registries` block.
> - **Phase 2:** Deploy the AcrPull role assignment as a **separate module** using outputs from Phase 1.
>
> AZD handles the real image update via the Azure Container Apps API directly — the Bicep template does **not** need a `registries` block.

## Phase 1: Container App Module (No Registry Link)

```bicep
// Placeholder image allows provisioning before app image exists in ACR.
// No registries block needed — AZD updates the image after provisioning via Azure API.
param containerImageName string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      // No registries block — AZD pushes the real image and updates the container app
      // image reference via the Azure API; a registries block is not required.
    }
    template: {
      containers: [
        {
          name: serviceName
          image: containerImageName
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
    }
  }
}

output systemAssignedMIPrincipalId string = containerApp.identity.principalId
```

## Phase 2: AcrPull Role Assignment Module (acr-pull-role.bicep)

Place this in a **separate module file** so neither the ACR module nor the Container App module depends on it, eliminating the circular dependency.

```bicep
// acr-pull-role.bicep
param acrName string
param principalId string

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' existing = {
  name: acrName
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, principalId, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```

> 💡 **Tip:** Always set `principalType: 'ServicePrincipal'` for managed identities. This avoids a Graph API lookup and speeds up role assignment propagation.

## Wiring Phase 1 and Phase 2 in main.bicep

```bicep
// Phase 1: ACR and Container App — neither module depends on the role assignment
module containerRegistry './modules/container-registry.bicep' = {
  name: 'containerRegistry'
  scope: rg
  params: { /* ... */ }
}

module api './modules/container-app.bicep' = {
  name: 'api'
  scope: rg
  params: {
    containerImageName: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
    // No registries param — AZD handles image update after provisioning
    /* ... */
  }
}

// Phase 2: Role assignment depends on outputs of both Phase 1 modules,
// but neither Phase 1 module depends on this — no circular dependency.
module acrPullRole './modules/acr-pull-role.bicep' = {
  name: 'acrPullRole'
  scope: rg
  params: {
    acrName: containerRegistry.outputs.name
    principalId: api.outputs.systemAssignedMIPrincipalId
  }
}
```

## Container Apps Environment

```bicep
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${resourcePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}
```
