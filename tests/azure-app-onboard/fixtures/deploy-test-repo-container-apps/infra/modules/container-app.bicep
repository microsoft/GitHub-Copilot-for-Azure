param location string
param containerAppName string
param managedEnvironmentId string
param acrName string
param keyVaultName string
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param appPort int = 3000
param basePath string = '/wetty/'
param title string = 'WeTTY - The Web Terminal Emulator'
param sshHost string = 'localhost'
param sshPort int = 22
param sshUser string = ''
param sshAuth string = 'password'
param sshKeyPath string = ''
param knownHosts string = '/dev/null'
param sshConfig string = ''
param forceSsh bool = false
param command string = 'login'
param allowIframe bool = false
param tags object

var isPlaceholder = containerImage == 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var effectivePort = isPlaceholder ? 80 : appPort
// WeTTY registers GET /wetty (trimmed, no trailing slash) — avoid 301 redirect that ACA probes won't follow
var basePathTrimmed = endsWith(basePath, '/') ? substring(basePath, 0, length(basePath) - 1) : basePath
var probePath = isPlaceholder ? '/' : basePathTrimmed

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: managedEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: effectivePort
        transport: 'auto'
        allowInsecure: false
      }
      registries: isPlaceholder ? [] : [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: isPlaceholder ? [] : [
        {
          name: 'ssh-password'
          keyVaultUrl: 'https://${keyVault.name}.vault.azure.net/secrets/ssh-password'
          identity: 'system'
        }
        {
          name: 'applicationinsights-connection-string'
          keyVaultUrl: 'https://${keyVault.name}.vault.azure.net/secrets/applicationinsights-connection-string'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'wetty'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat(
            [
              {
                name: 'PORT'
                value: string(effectivePort)
              }
              {
                name: 'NODE_ENV'
                value: 'production'
              }
              {
                name: 'SSHHOST'
                value: sshHost
              }
              {
                name: 'SSHPORT'
                value: string(sshPort)
              }
              {
                name: 'SSHUSER'
                value: sshUser
              }
              {
                name: 'SSHAUTH'
                value: sshAuth
              }
              {
                name: 'SSHKEY'
                value: sshKeyPath
              }
              {
                name: 'BASE'
                value: basePath
              }
              {
                name: 'TITLE'
                value: title
              }
              {
                name: 'FORCESSH'
                value: string(forceSsh)
              }
              {
                name: 'COMMAND'
                value: command
              }
              {
                name: 'KNOWNHOSTS'
                value: knownHosts
              }
              {
                name: 'SSHCONFIG'
                value: sshConfig
              }
              {
                name: 'ALLOWIFRAME'
                value: string(allowIframe)
              }
            ],
            isPlaceholder ? [] : [
              {
                name: 'SSHPASS'
                secretRef: 'ssh-password'
              }
              {
                name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
                secretRef: 'applicationinsights-connection-string'
              }
            ]
          )
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: probePath
                port: effectivePort
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: probePath
                port: effectivePort
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.name, 'acr-pull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, containerApp.name, 'key-vault-secrets-user')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output url string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output principalId string = containerApp.identity.principalId
