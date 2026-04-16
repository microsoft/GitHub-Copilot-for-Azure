# ACR Recipe — REFERENCE ONLY

Azure Container Registry build and push workflow for Container Apps.

## When to Use

- Building container images in Azure (no local Docker needed)
- CI/CD pipeline for Container Apps
- Private container registry with managed identity pull

## Bicep — ACR Module

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param principalId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// RBAC — AcrPull for Container App
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, principalId, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// RBAC — AcrPush for build agent / deployer
resource acrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, principalId, '8311e382-0749-4cb8-b61a-304f252e45ec')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '8311e382-0749-4cb8-b61a-304f252e45ec'
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output loginServer string = acr.properties.loginServer
output name string = acr.name
```

## Container App Registry Configuration

```bicep
configuration: {
  registries: [
    {
      server: acr.outputs.loginServer
      identity: userAssignedIdentityId
    }
  ]
}
```

## ACR Build (Cloud Build)

Build images in Azure without local Docker:

```bash
az acr build \
  --registry <acr-name> \
  --image myapp:latest \
  --file Dockerfile .
```

## AZD + ACR Workflow

With `azd`, image build and push is handled automatically:

```yaml
# azure.yaml
services:
  web:
    host: containerapp
    project: .
    docker:
      path: Dockerfile
```

`azd deploy` automatically:
1. Builds the image via ACR Tasks
2. Pushes to the linked ACR
3. Updates the Container App with the new image

## RBAC Roles

| Role | GUID | Access |
|------|------|--------|
| AcrPull | `7f951dda-4ed3-4680-a7ca-43fe172d538d` | Pull images |
| AcrPush | `8311e382-0749-4cb8-b61a-304f252e45ec` | Push + pull images |
| AcrDelete | `c2f4ef07-c644-48eb-af81-4b1b4947fb11` | Delete images |

> ⚠️ **Never enable admin user** (`adminUserEnabled: false`).
> Use managed identity for image pull.
