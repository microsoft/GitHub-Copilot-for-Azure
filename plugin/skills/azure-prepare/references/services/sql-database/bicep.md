# SQL Database - Bicep Patterns

> ⛔ **CRITICAL — SQL Server Bicep MUST use Entra-only authentication. NEVER include `administratorLogin` or `administratorLoginPassword` anywhere in a Bicep file — not even inside a conditional (`condition ? { ... } : { administratorLoginPassword: ... }`) branch. If either property name appears anywhere in the file, the deployment will be rejected. Always use the pattern below.**

## Basic Setup (Entra-Only Authentication)

**Required approach** — Uses Microsoft Entra ID authentication only. Required for all subscriptions; SQL admin authentication is disabled by policy.

```bicep
param principalId string
param principalName string

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${resourcePrefix}-sql-${uniqueHash}'
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'User'
      login: principalName
      sid: principalId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648  // 2 GB
  }
}

resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}
```

**Set Entra admin parameters:**

1. Get current user info:
```bash
az ad signed-in-user show --query "{id:id, name:displayName}" -o json
```

2. Set as azd environment variables:
```bash
PRINCIPAL_INFO=$(az ad signed-in-user show --query "{id:id, name:displayName}" -o json)
azd env set AZURE_PRINCIPAL_ID $(echo $PRINCIPAL_INFO | jq -r '.id')
azd env set AZURE_PRINCIPAL_NAME $(echo $PRINCIPAL_INFO | jq -r '.name')
```

> 💡 **Tip:** Set these variables immediately after `azd init` to avoid deployment failures. The Bicep `principalId` and `principalName` parameters will automatically use these environment variables.

## Serverless Configuration

```bicep
resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: 60  // minutes
    minCapacity: json('0.5')
  }
}
```

## Private Endpoint

```bicep
resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: '${sqlServer.name}-pe'
  location: location
  properties: {
    subnet: {
      id: subnet.id
    }
    privateLinkServiceConnections: [
      {
        name: '${sqlServer.name}-connection'
        properties: {
          privateLinkServiceId: sqlServer.id
          groupIds: ['sqlServer']
        }
      }
    ]
  }
}
```

## Legacy SQL Authentication (⛔ DO NOT USE — EVER)

> ❌ **PROHIBITED — NEVER generate `administratorLogin` or `administratorLoginPassword` properties.**
> This applies unconditionally: do NOT include them in direct assignments, conditional expressions, ternary branches, parameter defaults, or any other construct. The **text** of these property names must not appear anywhere in a generated `.bicep` file.
> SQL admin authentication is disabled in all subscriptions with Entra-only policies and violates Azure security best practices.
> Always use the Entra-only authentication pattern at the top of this file.
>
> ❌ **DO NOT generate conditional patterns like:**
> ```bicep
> properties: useEntraAuth ? {
>   administrators: { azureADOnlyAuthentication: true ... }
> } : {
>   administratorLogin: sqlAdminLogin          // ❌ PROHIBITED
>   administratorLoginPassword: sqlAdminPassword  // ❌ PROHIBITED
> }
> ```
> Use only the unconditional Entra-only pattern. No fallback. No toggle. No conditional.
