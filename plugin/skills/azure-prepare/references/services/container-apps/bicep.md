# Container Apps Bicep Patterns

> **⚠️ Container Registry Naming:** If using Azure Container Registry, names must be alphanumeric only (5-50 characters). Use `replace()` to remove hyphens: `replace('cr${environmentName}${resourceSuffix}', '-', '')`

## Basic Resource

```bicep
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  properties: {
    environmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
    }
    template: {
      containers: [
        {
          name: serviceName
          image: '${containerRegistry.properties.loginServer}/${serviceName}:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
    }
  }
}
```

## With Managed Identity (Recommended)

```bicep
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    // ... configuration
  }
}
```

## AcrPull Role Assignment (Required for Managed Identity + ACR)

> ⚠️ **CRITICAL**: When a Container App uses a managed identity to pull images from ACR, you **MUST** include the `AcrPull` role assignment in the Bicep template. Without it, the Container App revision will fail with an image pull timeout (up to 900 seconds) because RBAC permissions haven't been granted.

```bicep
// AcrPull role definition ID: 7f951dda-4ed3-4680-a7ca-43fe172d538d
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerApp.id, containerRegistry.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

> 💡 **Tip:** Always set `principalType: 'ServicePrincipal'` for managed identities. This avoids a Graph API lookup and speeds up role assignment propagation. Even with the role in Bicep, Azure RBAC propagation can take 1–5 minutes. If `azd up` provisions infrastructure and deploys in one step, the revision may attempt an image pull before the role has propagated. To mitigate this:
>
> 1. **Preferred**: Use `azd provision` followed by `azd deploy` (separate steps) to allow propagation time
> 2. **Alternative**: Use admin credentials for registry auth instead of managed identity (less secure but avoids propagation delay)
> 3. **Alternative**: Configure the registry block with `identity` referencing the managed identity selector (`'system'`) for a system-assigned identity, or the user-assigned identity resource ID for a user-assigned identity, instead of admin credentials:
>
> ```bicep
> registries: [
>   {
>     server: containerRegistry.properties.loginServer
>     identity: 'system'
>   }
> ]
> ```

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
